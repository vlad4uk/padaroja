import React, { useState } from 'react';
import { FaFlag } from 'react-icons/fa';
import ReportModal from './ReportModal.tsx';

interface CommentReportButtonProps {
    commentID: number;
    onReport: (commentID: number, reason: string) => Promise<void>;
    disabled?: boolean;
}

const CommentReportButton: React.FC<CommentReportButtonProps> = ({
    commentID,
    onReport,
    disabled = false
}) => {
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);

    const handleReportSubmit = async (reason: string) => {
        setIsReporting(true);
        try {
            await onReport(commentID, reason);
            alert('Жалоба на комментарий отправлена модераторам');
        } catch (error: any) {
            console.error('Ошибка при отправке жалобы:', error);
            alert(error.response?.data?.error || 'Ошибка при отправке жалобы');
        } finally {
            setIsReporting(false);
        }
    };

    return (
        <>
            <button 
                className="report-btn"
                onClick={() => setIsReportModalOpen(true)}
                disabled={disabled}
                title="Пожаловаться на комментарий"
            >
                <FaFlag style={{ marginRight: '4px' }} />
                Пожаловаться
            </button>

            {/* Модальное окно для жалоб на комментарии */}
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onSubmit={handleReportSubmit}
                title="Пожаловаться на комментарий"
                description="Опишите причину жалобы на комментарий. Модераторы проверят этот контент."
                placeholder="Причина жалобы..."
                loading={isReporting}
            />
        </>
    );
};

export default CommentReportButton;