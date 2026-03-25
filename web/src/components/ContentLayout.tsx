import React, { ReactNode } from 'react';
import Sidebar from '../components/Sidebar.tsx';
import '../components/MainLayout.css'; 

interface ContentLayoutProps {
    children: ReactNode; 
}

const ContentLayout: React.FC<ContentLayoutProps> = ({ children }) => {
    
    return (
        <div className="app-container">
            <Sidebar />

            {/* main-content - это область справа от Sidebar */}
            <main className="main-content">
                {/* content-area - это внутренняя обертка для padding'ов и стилей */}
                <div className="content-area">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default ContentLayout;