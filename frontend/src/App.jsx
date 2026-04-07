import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppLayout from './components/app-layout';
import DeviceListPage from './pages/device-list-page';
import DeviceCreatePage from './pages/device-create-page';
import DeviceDetailPage from './pages/device-detail-page';
import DeviceEditPage from './pages/device-edit-page';
import PublicDevicePage from './pages/public-device-page';
import LocationListPage from './pages/location-list-page';

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
      <Routes>
        <Route path="/" element={<Navigate to="/devices" replace />} />
        
        <Route element={<AdminLayout />}>
          <Route path="/devices" element={<DeviceListPage />} />
          <Route path="/devices/new" element={<DeviceCreatePage />} />
          <Route path="/devices/:id" element={<DeviceDetailPage />} />
          <Route path="/devices/:id/edit" element={<DeviceEditPage />} />
          <Route path="/locations" element={<LocationListPage />} />
        </Route>

        <Route path="/public/device/:id" element={<PublicDevicePage />} />
      </Routes>
    </BrowserRouter>
  );
}
