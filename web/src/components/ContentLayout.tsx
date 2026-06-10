import React, { ReactNode } from 'react';
import Sidebar from './Sidebar.tsx';
import './MainLayout.css'; 

interface ContentLayoutProps {
    children: ReactNode; 
}

const ContentLayout: React.FC<ContentLayoutProps> = ({ children }) => {
    
    return (
        <div className="app-container">
            <Sidebar />

            <main className="main-content">
                <div className="content-area">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default ContentLayout;