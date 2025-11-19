import React, { ReactNode } from 'react';
import Sidebar from '../components/Sidebar.tsx';
// Предполагаем, что стили для app-container и main-content находятся в MainLayout.css
import '../components/MainLayout.css'; 

// Определяем интерфейс для приема дочерних элементов (контента страницы)
interface ContentLayoutProps {
    children: ReactNode; 
}

/**
 * Универсальный компонент-обертка, обеспечивающий каркас: 
 * Sidebar слева и область Main Content справа.
 */
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