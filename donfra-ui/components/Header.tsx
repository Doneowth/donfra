"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import SignInModal from "@/components/auth/SignInModal";
import SignUpModal from "@/components/auth/SignUpModal";

type NavItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/live", label: "Live" },
  { href: "/interview", label: "Interview", requiresAuth: true },
  { href: "/admin-dashboard", label: "Admin", roles: ["admin", "god"] },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSwitchToSignUp = () => {
    setShowSignIn(false);
    setShowSignUp(true);
  };

  const handleSwitchToSignIn = () => {
    setShowSignUp(false);
    setShowSignIn(true);
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.roles) {
      return user && item.roles.includes(user.role);
    }
    if (item.requiresAuth) {
      return !!user;
    }
    return true;
  });

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <a href="/" className="logo">
            <img
              src="/donfra.png"
              alt="Donfra"
              style={{ height: 70, width: "auto", border: "none", outline: "none" }}
            />
          </a>
          <nav className="nav">
            {visibleNavItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? "nav-active" : ""}
              >
                {item.label}
              </a>
            ))}

            {user ? (
              <div className="user-menu">
                <span className="user-welcome">Welcome,</span>
                <button
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {user.username || user.email}
                </button>
                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="user-info">
                      <p className="user-email">{user.email}</p>
                      <p className="user-role">{user.role}</p>
                    </div>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        router.push("/user");
                        setShowUserMenu(false);
                      }}
                    >
                      Profile
                    </button>
                    <button className="dropdown-item" onClick={handleLogout}>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="nav-auth-btn" onClick={() => setShowSignIn(true)}>
                  Sign In
                </button>
                <button
                  className="nav-auth-btn nav-auth-btn-primary"
                  onClick={() => setShowSignUp(true)}
                >
                  Sign Up
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={handleSwitchToSignUp}
      />
      <SignUpModal
        isOpen={showSignUp}
        onClose={() => setShowSignUp(false)}
        onSwitchToSignIn={handleSwitchToSignIn}
      />
    </>
  );
}
