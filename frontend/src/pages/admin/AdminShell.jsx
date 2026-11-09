import { SocketProvider } from '../../context/SocketContext';
import AdminLayout from '../../components/admin/AdminLayout';

/** Logged-in admin area: live socket connection + layout around all admin pages */
export default function AdminShell() {
  return (
    <SocketProvider>
      <AdminLayout />
    </SocketProvider>
  );
}
