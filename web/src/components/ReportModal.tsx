// src/components/ReportModal.tsx (обновленная версия)
import React, { useState } from 'react';
import './ReportModal.css';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void> | void;
    title?: string;
    description?: string;
    placeholder?: string;
    loading?: boolean;
}

const ReportModal: React.FC<ReportModalProps> = ({ 
    isOpen, 
    onClose, 
    onSubmit,
    title = "Пожаловаться",
    description = "Опишите причину жалобы. Модераторы проверят этот контент.",
    placeholder = "Причина жалобы...",
    loading = false
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!reason.trim()) {
            setError('Пожалуйста, укажите причину жалобы.');
            return;
        }
        
        try {
            await onSubmit(reason);
            setReason('');
            setError('');
            onClose();
        } catch (error) {
            console.error('Ошибка при отправке жалобы:', error);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{description}</p>
                
                <textarea
                    className="report-textarea"
                    placeholder={placeholder}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    disabled={loading}
                />
                
                {error && <div className="report-error">{error}</div>}

                <div className="modal-actions">
                    <button 
                        className="btn-cancel" 
                        onClick={onClose}
                        disabled={loading}
                    >
                        Отмена
                    </button>
                    <button 
                        className="btn-submit" 
                        onClick={handleSubmit}
                        disabled={!reason.trim() || loading}
                    >
                        {loading ? 'Отправка...' : 'Отправить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;