import { AttendanceScanClient } from "@/features/attendance/components/AttendanceScanClient";

type Props = { params: Promise<{ token: string }> };

export default async function AttendanceScanPage({ params }: Props) {
  const { token } = await params;
  return <AttendanceScanClient token={token} />;
}
