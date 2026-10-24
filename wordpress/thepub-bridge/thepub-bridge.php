<?php
/**
 * Plugin Name: The Pub Bridge
 * Description: Login y registro de clientes para el sistema del restaurante. WooCommerce no puede comprobar contraseñas por su REST API; este endpoint sí, con un secreto compartido.
 * Version: 1.0.0
 * Author: The Pub Game Store
 *
 * Instalación:
 * 1. Copia esta carpeta a wp-content/plugins/thepub-bridge y actívala.
 * 2. En wp-config.php, antes de "That's all, stop editing!":
 *    define('THEPUB_BRIDGE_SECRET', 'el-mismo-valor-que-WORDPRESS_BRIDGE_SECRET');
 * 3. WooCommerce debe estar activo. Las cuentas que se crean aquí son clientes de la tienda.
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action('rest_api_init', function () {
	register_rest_route('thepub/v1', '/login', array(
		'methods' => 'POST',
		'callback' => 'thepub_bridge_login',
		'permission_callback' => 'thepub_bridge_permission',
	));

	register_rest_route('thepub/v1', '/register', array(
		'methods' => 'POST',
		'callback' => 'thepub_bridge_register',
		'permission_callback' => 'thepub_bridge_permission',
	));
});

/**
 * Shared secret. Prefer wp-config.php; getenv is only a fallback.
 */
function thepub_bridge_secret() {
	if (defined('THEPUB_BRIDGE_SECRET') && THEPUB_BRIDGE_SECRET) {
		return (string) THEPUB_BRIDGE_SECRET;
	}
	$env = getenv('THEPUB_BRIDGE_SECRET');
	return is_string($env) ? $env : '';
}

function thepub_bridge_permission(WP_REST_Request $request) {
	$secret = thepub_bridge_secret();
	if ($secret === '') {
		return new WP_Error('thepub_not_configured', 'El puente no tiene secreto configurado.', array('status' => 503));
	}

	$header = $request->get_header('x-thepub-secret');
	if (!is_string($header) || !hash_equals($secret, $header)) {
		return new WP_Error('thepub_forbidden', 'No autorizado.', array('status' => 401));
	}

	return true;
}

/**
 * Customers and subscribers only. Store staff, admins, and YITH cashiers stay out.
 */
function thepub_bridge_is_customer($user) {
	if (!($user instanceof WP_User)) {
		return false;
	}

	$roles = array_values(array_filter((array) $user->roles, 'is_string'));
	if (count($roles) === 0) {
		return false;
	}

	$allowed = array('customer', 'subscriber');
	foreach ($roles as $role) {
		if (!in_array($role, $allowed, true)) {
			return false;
		}
	}

	return true;
}

function thepub_bridge_rate_limit($email) {
	$key = 'thepub_rl_' . md5(strtolower((string) $email));
	$count = (int) get_transient($key);
	if ($count >= 15) {
		return new WP_Error(
			'thepub_rate',
			'Demasiados intentos. Espera unos minutos.',
			array('status' => 429)
		);
	}
	set_transient($key, $count + 1, 15 * MINUTE_IN_SECONDS);
	return null;
}

function thepub_bridge_clear_rate_limit($email) {
	delete_transient('thepub_rl_' . md5(strtolower((string) $email)));
}

function thepub_bridge_payload($user) {
	$first = (string) get_user_meta($user->ID, 'first_name', true);
	$last = (string) get_user_meta($user->ID, 'last_name', true);
	$name = trim($first . ' ' . $last);
	if ($name === '') {
		$name = (string) $user->display_name;
	}

	$phone = (string) get_user_meta($user->ID, 'billing_phone', true);

	return array(
		'id' => (int) $user->ID,
		'email' => (string) $user->user_email,
		'name' => $name,
		'phone' => $phone,
	);
}

function thepub_bridge_split_name($name) {
	$clean = trim(preg_replace('/\s+/', ' ', (string) $name));
	if ($clean === '') {
		return array('', '');
	}
	$parts = explode(' ', $clean, 2);
	return array($parts[0], isset($parts[1]) ? $parts[1] : '');
}

function thepub_bridge_login(WP_REST_Request $request) {
	$email = sanitize_email((string) $request->get_param('email'));
	$password = (string) $request->get_param('password');

	if ($email === '' || !is_email($email) || $password === '') {
		return new WP_Error('thepub_invalid', 'Escribe correo y contraseña.', array('status' => 400));
	}

	$limited = thepub_bridge_rate_limit($email);
	if ($limited) {
		return $limited;
	}

	$user = wp_authenticate($email, $password);
	if (is_wp_error($user)) {
		return new WP_Error('thepub_invalid', 'Correo o contraseña incorrectos.', array('status' => 401));
	}

	if (!thepub_bridge_is_customer($user)) {
		return new WP_Error(
			'thepub_staff',
			'Esta cuenta es de personal de la tienda. Usa el acceso del restaurante.',
			array('status' => 403)
		);
	}

	thepub_bridge_clear_rate_limit($email);
	return rest_ensure_response(thepub_bridge_payload($user));
}

function thepub_bridge_register(WP_REST_Request $request) {
	if (!function_exists('wc_create_new_customer')) {
		return new WP_Error('thepub_no_wc', 'WooCommerce no está activo.', array('status' => 503));
	}

	$email = sanitize_email((string) $request->get_param('email'));
	$password = (string) $request->get_param('password');
	$name = sanitize_text_field((string) $request->get_param('name'));
	$phone = sanitize_text_field((string) $request->get_param('phone'));

	if ($email === '' || !is_email($email)) {
		return new WP_Error('thepub_invalid', 'Escribe un correo válido.', array('status' => 400));
	}
	if (strlen($password) < 8) {
		return new WP_Error('thepub_invalid', 'La contraseña debe tener al menos 8 caracteres.', array('status' => 400));
	}
	if (strlen($name) < 2) {
		return new WP_Error('thepub_invalid', 'Escribe tu nombre.', array('status' => 400));
	}

	$limited = thepub_bridge_rate_limit($email);
	if ($limited) {
		return $limited;
	}

	list($first, $last) = thepub_bridge_split_name($name);

	$customer_id = wc_create_new_customer($email, '', $password, array(
		'first_name' => $first,
		'last_name' => $last,
		'display_name' => $name,
		'role' => 'customer',
	));

	if (is_wp_error($customer_id)) {
		$code = $customer_id->get_error_code();
		$status = $code === 'registration-error-email-exists' ? 409 : 400;
		$message = $status === 409
			? 'Ya existe una cuenta con ese correo. Entra con tu contraseña.'
			: 'No se pudo crear la cuenta.';
		error_log('[thepub-bridge] register ' . $code);
		return new WP_Error('thepub_register', $message, array('status' => $status));
	}

	update_user_meta($customer_id, 'billing_first_name', $first);
	update_user_meta($customer_id, 'billing_last_name', $last);
	update_user_meta($customer_id, 'billing_email', $email);
	if ($phone !== '') {
		update_user_meta($customer_id, 'billing_phone', $phone);
	}

	$user = get_user_by('id', $customer_id);
	if (!($user instanceof WP_User) || !thepub_bridge_is_customer($user)) {
		return new WP_Error('thepub_register', 'No se pudo crear la cuenta de cliente.', array('status' => 500));
	}

	thepub_bridge_clear_rate_limit($email);
	return rest_ensure_response(thepub_bridge_payload($user));
}
