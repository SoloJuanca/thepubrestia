-- One modifier group name per menu item (drops the duplicate toppings rows).
CREATE UNIQUE INDEX "ModifierGroup_menuItemId_name_key" ON "ModifierGroup"("menuItemId", "name");
