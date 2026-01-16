'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Ticket, User } from 'lucide-react';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Ticket className="h-8 w-8 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">RifaMax</span>
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Rifas
            </Link>
            {isLoggedIn ? (
              <>
                <Link href="/my-tickets" className="text-gray-600 hover:text-gray-900">
                  Mis Tickets
                </Link>
                <Link href="/my-raffles" className="text-gray-600 hover:text-gray-900">
                  Mis Rifas
                </Link>
                <Link href="/create-raffle" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                  Crear Rifa
                </Link>
                <Link href="/profile" className="text-gray-600 hover:text-gray-900">
                  <User className="h-5 w-5" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-gray-900">
                  Iniciar Sesión
                </Link>
                <Link href="/register" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                  Registrarse
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t">
          <div className="px-4 py-3 space-y-3">
            <Link href="/" className="block text-gray-600 hover:text-gray-900">
              Rifas
            </Link>
            {isLoggedIn ? (
              <>
                <Link href="/my-tickets" className="block text-gray-600 hover:text-gray-900">
                  Mis Tickets
                </Link>
                <Link href="/my-raffles" className="block text-gray-600 hover:text-gray-900">
                  Mis Rifas
                </Link>
                <Link href="/create-raffle" className="block text-gray-600 hover:text-gray-900">
                  Crear Rifa
                </Link>
                <Link href="/profile" className="block text-gray-600 hover:text-gray-900">
                  Mi Perfil
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="block text-gray-600 hover:text-gray-900">
                  Iniciar Sesión
                </Link>
                <Link href="/register" className="block text-gray-600 hover:text-gray-900">
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
