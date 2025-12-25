'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Calendar, Users, LogOut } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Scheduled', href: '/scheduled', icon: Calendar },
    { name: 'Contacts', href: '/contacts', icon: Users },
  ];

  const isActive = (href: string) => pathname === href;

  const handleLogout = () => {
    document.cookie = 'auth=; Max-Age=0; path=/;';
    router.push('/login');
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-60 bg-[#1a1a1a] border-r border-[#404040] flex flex-col">
      {/* Logo */}
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">WA</span>
          </div>
          <span className="text-white font-semibold text-lg">Scheduler</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                transition-all duration-150
                ${active
                  ? 'bg-[#2d2d2d] text-white border-l-4 border-blue-500 pl-3'
                  : 'text-[#a3a3a3] hover:bg-[#2d2d2d] hover:text-white'
                }
              `}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[#404040]">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">S</span>
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Saadi</p>
            <p className="text-[#737373] text-xs">Admin</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 mt-2 rounded-lg text-sm font-medium
                     text-[#a3a3a3] hover:bg-[#2d2d2d] hover:text-white transition-colors"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
