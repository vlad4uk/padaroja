import React, { useState, useEffect } from 'react';
import './ReportModal.css';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void> | void;
    title?: string;
    description?: string;
    placeholder?: string;
    loading?: boolean;
    minLength?: number;
    maxLength?: number;
}

const ReportModal: React.FC<ReportModalProps> = ({ 
    isOpen, 
    onClose, 
    onSubmit,
    title = "Пожаловаться",
    description = "Опишите причину жалобы. Модераторы проверят этот контент.",
    placeholder = "Причина жалобы...",
    loading = false,
    minLength = 10,
    maxLength = 500
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setReason('');
            setError('');
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && e.ctrlKey && reason.trim().length >= minLength) {
                e.preventDefault();
                handleSubmit();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, reason, onClose]);

    const handleSubmit = async () => {
        const trimmedReason = reason.trim();
        
        if (trimmedReason.length < minLength) {
            setError(`Минимальная длина сообщения: ${minLength} символов`);
            return;
        }
        
        if (trimmedReason.length > maxLength) {
            setError(`Максимальная длина сообщения: ${maxLength} символов`);
            return;
        }
        
        try {
            await onSubmit(trimmedReason);
        } catch (error) {
            console.error('Ошибка при отправке жалобы:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <p className="modal-description">{description}</p>
                </div>
                
                <div className="modal-body">
                    <textarea
                        className="report-textarea"
                        placeholder={placeholder}
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            setError(''); 
                        }}
                        rows={4}
                        disabled={loading}
                        maxLength={maxLength}
                        autoFocus
                    />
                    
                    <div className="textarea-info">
                        <span className="char-count">
                            {reason.length}/{maxLength}
                            {reason.length < minLength && reason.length > 0 && 
                                ` (минимум ${minLength})`}
                        </span>
                    </div>
                    
                    {error && <div className="report-error">{error}</div>}
                </div>

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
                        disabled={!reason.trim() || reason.trim().length < minLength || loading}
                        title={reason.trim().length < minLength ? 
                            `Минимум ${minLength} символов` : ''}
                    >
                        {loading ? 'Отправка...' : 'Отправить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;