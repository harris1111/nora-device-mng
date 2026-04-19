import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/auth-context';
import ProtectedRoute from './components/auth/protected-route';
import AppLayout from './components/layout/app-layout';
import LoginPage from './pages/login-page';
import DeviceListPage from './pages/device-list-page';
import DeviceCreatePage from './pages/device-create-page';
import DeviceDetailPage from './pages/device-detail-page';
import DeviceEditPage from './pages/device-edit-page';
import PublicDevicePage from './pages/public-device-page';
import LocationListPage from './pages/location-list-page';
import UsersListPage from './pages/users-list-page';
import UserFormPage from './pages/user-form-page';
import PermissionDashboardPage from './pages/permission-dashboard-page';
import AuditLogPage from './pages/audit-log-page';
import ExcelExportPage from './pages/excel-export-page';

function AdminLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/public/device/:id" element={<PublicDevicePage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/devices" replace />} />
            <Route element={<AdminLayout />}>
              <Route path="/devices" element={<DeviceListPage />} />
              <Route path="/devices/new" element={<DeviceCreatePage />} />
              <Route path="/devices/:id" element={<DeviceDetailPage />} />
              <Route path="/devices/:id/edit" element={<DeviceEditPage />} />
              <Route path="/locations" element={<LocationListPage />} />
              <Route path="/users" element={<UsersListPage />} />
              <Route path="/users/new" element={<UserFormPage />} />
              <Route path="/users/:id/edit" element={<UserFormPage />} />
              <Route path="/permissions" element={<PermissionDashboardPage />} />
              <Route path="/audit-logs" element={<AuditLogPage />} />
              <Route path="/export" element={<ExcelExportPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
