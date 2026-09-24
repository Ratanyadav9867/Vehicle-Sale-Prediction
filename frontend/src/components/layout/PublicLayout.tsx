import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PublicLayout() {
  return (
    <div className="relative min-h-screen bg-transparent text-gray-100 flex flex-col selection:bg-sky-500 selection:text-white overflow-x-hidden pb-20 md:pb-0">
      {/* Header with z-50 */}
      <Navbar />

      {/* Content layers sitting above video with relative z-10 */}
      <div className="relative z-10 flex-1 flex flex-col pt-16">
        <Outlet />
      </div>

      {/* Footer sitting above video */}
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
