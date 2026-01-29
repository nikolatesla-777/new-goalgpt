/**
 * Admin Layout Component
 * Premium flat minimal design with Satoshi font
 */

import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './admin.css';
import { MENU_SECTIONS } from '../../config/admin.registry';
import { ICON_MAP } from './AdminIcons';

export function AdminLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const location = useLocation();

    // Close mobile menu when route changes
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="admin-container">
            {/* Mobile Header */}
            <div className="admin-mobile-header">
                <button
                    className="admin-hamburger-btn"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle Menu"
                >
                    {isMobileMenuOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 24, height: 24 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 24, height: 24 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    )}
                </button>
                <div className="admin-mobile-logo">
                    <span>Goal</span>GPT
                </div>
                <div className="admin-mobile-header-spacer"></div>
            </div>

            {/* Sidebar (Dropdown on mobile) */}
            <aside className={`admin-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                <div className="admin-sidebar-logo">
                    <h1>
                        <span>Goal</span>GPT
                    </h1>
                    <button
                        className="admin-sidebar-close"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 24, height: 24 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <nav className="admin-sidebar-nav">
                    {MENU_SECTIONS.map((section) => (
                        <div key={section.label} className="admin-nav-section">
                            <div className="admin-nav-label">{section.label}</div>
                            {section.items.map((item) => {
                                const IconComponent = ICON_MAP[item.iconKey];
                                return (
                                    <NavLink
                                        key={item.id}
                                        to={item.routePath}
                                        end={item.routePath === '/'}
                                        data-menu-id={item.id}
                                        className={({ isActive }) =>
                                            `admin-nav-item ${isActive ? 'active' : ''}`
                                        }
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <IconComponent />
                                        <span>{item.label}</span>
                                        {item.comingSoon && (
                                            <span className="coming-soon-badge">Yakında</span>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}
