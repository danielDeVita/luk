'use client';

import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import {
  User,
  LogOut,
  Ticket,
  PlusCircle,
  Settings,
  Heart,
  MessageSquare,
  MapPin,
  DollarSign,
  Menu,
  X,
  Home,
  Search,
  Sparkles,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { NotificationsBell } from './notifications-bell';
import { ThemeToggle } from './ui/theme-toggle';

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Handle keyboard navigation for dropdown
  const handleDropdownKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!dropdownOpen) {
      // Open dropdown on Enter, Space, or ArrowDown
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        setDropdownOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setDropdownOpen(false);
        setFocusedIndex(-1);
        dropdownButtonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((prev) => {
          const nextIndex = prev < menuItemsRef.current.length - 1 ? prev + 1 : 0;
          return nextIndex;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex((prev) => {
          const nextIndex = prev > 0 ? prev - 1 : menuItemsRef.current.length - 1;
          return nextIndex;
        });
        break;
      case 'Tab':
        // Close dropdown on Tab
        setDropdownOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(menuItemsRef.current.length - 1);
        break;
    }
  }, [dropdownOpen]);

  // Focus the current menu item when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && menuItemsRef.current[focusedIndex]) {
      menuItemsRef.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Reset menu items ref when dropdown closes
  useEffect(() => {
    if (!dropdownOpen) {
      menuItemsRef.current = [];
    }
  }, [dropdownOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <Ticket className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg text-foreground">
            Rifas
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/">Inicio</NavLink>
          <NavLink href="/search">Explorar</NavLink>
          {isAuthenticated && (
            <NavLink href="/dashboard/create" icon={<Sparkles className="w-3.5 h-3.5" />}>
              Crear rifa
            </NavLink>
          )}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <NotificationsBell />

              <Link href="/dashboard/tickets">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <Ticket className="h-4 w-4" />
                  <span className="hidden lg:inline">Mis tickets</span>
                </Button>
              </Link>

              {/* User Dropdown */}
              <div
                ref={dropdownRef}
                className="relative"
                onMouseEnter={() => setDropdownOpen(true)}
                onMouseLeave={() => setDropdownOpen(false)}
                onKeyDown={handleDropdownKeyDown}
              >
                <Button
                  ref={dropdownButtonRef}
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover:bg-muted"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  aria-controls="user-dropdown-menu"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="max-w-[100px] truncate text-sm">{user?.nombre}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </Button>

                {/* Dropdown Menu */}
                <div
                  id="user-dropdown-menu"
                  role="menu"
                  aria-label="Menú de usuario"
                  className={`absolute right-0 top-full pt-2 w-56 transition-all duration-200 ${
                    dropdownOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                  }`}
                >
                  <div className="rounded-xl shadow-lg bg-card border overflow-hidden">
                    {/* User Info Header */}
                    <div className="px-4 py-3 bg-muted/50 border-b">
                      <p className="font-medium text-sm">{user?.nombre} {user?.apellido}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>

                    <div className="py-1.5">
                      {(() => {
                        let menuIndex = 0;
                        const items = [];

                        items.push(
                          <DropdownLink
                            key="sales"
                            href="/dashboard/sales"
                            icon={<PlusCircle className="h-4 w-4" />}
                            ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                          >
                            Mis rifas
                          </DropdownLink>
                        );
                        items.push(
                          <DropdownLink
                            key="favorites"
                            href="/dashboard/favorites"
                            icon={<Heart className="h-4 w-4" />}
                            ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                          >
                            Favoritos
                          </DropdownLink>
                        );
                        items.push(
                          <DropdownLink
                            key="messages"
                            href="/dashboard/messages"
                            icon={<MessageSquare className="h-4 w-4" />}
                            ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                          >
                            Mensajes
                          </DropdownLink>
                        );
                        items.push(
                          <DropdownLink
                            key="shipping"
                            href="/dashboard/shipping"
                            icon={<MapPin className="h-4 w-4" />}
                            ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                          >
                            Direcciones
                          </DropdownLink>
                        );
                        items.push(
                          <DropdownLink
                            key="payouts"
                            href="/dashboard/payouts"
                            icon={<DollarSign className="h-4 w-4" />}
                            ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                          >
                            Mis pagos
                          </DropdownLink>
                        );

                        if (user?.role === 'ADMIN') {
                          items.push(<div key="admin-divider" className="my-1.5 mx-3 border-t" role="separator" />);
                          items.push(
                            <DropdownLink
                              key="admin"
                              href="/admin"
                              icon={<ShieldCheck className="h-4 w-4" />}
                              ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                            >
                              Panel admin
                            </DropdownLink>
                          );
                        }

                        items.push(<div key="settings-divider" className="my-1.5 mx-3 border-t" role="separator" />);

                        items.push(
                          <DropdownLink
                            key="settings"
                            href="/dashboard/settings"
                            icon={<Settings className="h-4 w-4" />}
                            ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                          >
                            Configuración
                          </DropdownLink>
                        );

                        items.push(
                          <button
                            key="logout"
                            onClick={logout}
                            role="menuitem"
                            tabIndex={-1}
                            ref={(el) => { menuItemsRef.current[menuIndex++] = el; }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors focus:bg-destructive/5 focus:outline-none"
                          >
                            <LogOut className="h-4 w-4" />
                            Cerrar sesión
                          </button>
                        );

                        return items;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Iniciar sesión
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="btn-press">
                  Registrarse
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button + Notifications */}
        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle />
          {isAuthenticated && <NotificationsBell />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            className="relative w-9 h-9"
          >
            <Menu className={`h-5 w-5 absolute transition-all duration-200 ${mobileMenuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`} />
            <X className={`h-5 w-5 absolute transition-all duration-200 ${mobileMenuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`} />
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden border-t bg-background overflow-hidden transition-all duration-300 ${
        mobileMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <nav className="container mx-auto px-4 py-4 space-y-1">
          {/* Main Navigation */}
          <MobileNavLink href="/" onClick={closeMobileMenu} icon={<Home className="h-4 w-4" />}>
            Inicio
          </MobileNavLink>
          <MobileNavLink href="/search" onClick={closeMobileMenu} icon={<Search className="h-4 w-4" />}>
            Explorar
          </MobileNavLink>

          {isAuthenticated ? (
            <>
              <MobileNavLink href="/dashboard/create" onClick={closeMobileMenu} icon={<Sparkles className="h-4 w-4" />}>
                Crear rifa
              </MobileNavLink>

              <div className="border-t my-3" />

              <MobileNavLink href="/dashboard/tickets" onClick={closeMobileMenu} icon={<Ticket className="h-4 w-4" />}>
                Mis tickets
              </MobileNavLink>
              <MobileNavLink href="/dashboard/sales" onClick={closeMobileMenu} icon={<PlusCircle className="h-4 w-4" />}>
                Mis rifas
              </MobileNavLink>
              <MobileNavLink href="/dashboard/favorites" onClick={closeMobileMenu} icon={<Heart className="h-4 w-4" />}>
                Favoritos
              </MobileNavLink>
              <MobileNavLink href="/dashboard/messages" onClick={closeMobileMenu} icon={<MessageSquare className="h-4 w-4" />}>
                Mensajes
              </MobileNavLink>
              <MobileNavLink href="/dashboard/shipping" onClick={closeMobileMenu} icon={<MapPin className="h-4 w-4" />}>
                Direcciones
              </MobileNavLink>
              <MobileNavLink href="/dashboard/payouts" onClick={closeMobileMenu} icon={<DollarSign className="h-4 w-4" />}>
                Mis pagos
              </MobileNavLink>

              {user?.role === 'ADMIN' && (
                <MobileNavLink href="/admin" onClick={closeMobileMenu} icon={<ShieldCheck className="h-4 w-4" />}>
                  Panel admin
                </MobileNavLink>
              )}

              <div className="border-t my-3" />

              <MobileNavLink href="/dashboard/settings" onClick={closeMobileMenu} icon={<Settings className="h-4 w-4" />}>
                Configuración
              </MobileNavLink>

              <button
                onClick={() => {
                  logout();
                  closeMobileMenu();
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-destructive hover:bg-destructive/5 text-sm transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <div className="border-t my-3" />
              <div className="space-y-2 pt-2">
                <Link href="/auth/login" onClick={closeMobileMenu}>
                  <Button variant="outline" className="w-full justify-center">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link href="/auth/register" onClick={closeMobileMenu}>
                  <Button className="w-full justify-center">
                    Registrarse
                  </Button>
                </Link>
              </div>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1.5"
    >
      {icon}
      {children}
    </Link>
  );
}

const DropdownLink = forwardRef<
  HTMLAnchorElement,
  {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }
>(function DropdownLink({ href, icon, children }, ref) {
  return (
    <Link
      href={href}
      ref={ref}
      role="menuitem"
      tabIndex={-1}
      className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors focus:bg-muted/50 focus:outline-none"
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </Link>
  );
});

function MobileNavLink({
  href,
  onClick,
  icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/50 text-sm transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </Link>
  );
}
