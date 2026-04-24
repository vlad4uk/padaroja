import React, { useState, useEffect, useRef } from 'react';
import './ReportModal.css';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void>;
    title?: string;
    description?: string;
    placeholder?: string;
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
    minLength = 10,
    maxLength = 500
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const submitCountRef = useRef(0);

    // Сброс при открытии
    useEffect(() => {
        if (isOpen) {
            console.log('🔵 ReportModal OPENED - сброс состояния');
            setReason('');
            setError('');
            setIsSubmitting(false);
            submitCountRef.current = 0;
            setTimeout(() => textareaRef.current?.focus(), 50);
        } else {
            console.log('🔴 ReportModal CLOSED');
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        submitCountRef.current++;
        console.log(`📤 Попытка отправки #${submitCountRef.current}`, { reason, length: reason.trim().length });
        
        const trimmed = reason.trim();
        
        if (trimmed.length < minLength) {
            console.log('❌ Ошибка: слишком коротко');
            setError(`Минимум ${minLength} символов`);
            return;
        }
        
        if (trimmed.length > maxLength) {
            console.log('❌ Ошибка: слишком длинно');
            setError(`Максимум ${maxLength} символов`);
            return;
        }
        
        console.log('✅ Валидация пройдена, отправляем...');
        setIsSubmitting(true);
        setError('');
        
        try {
            await onSubmit(trimmed);
            console.log('✅ onSubmit успешно выполнен, закрываем модалку');
            onClose();
        } catch (err) {
            console.error('❌ Ошибка в onSubmit:', err);
            setError('Ошибка отправки. Попробуйте позже.');
        } finally {
            console.log('🏁 finally: снимаем isSubmitting');
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <p className="modal-description">{description}</p>
                </div>
                
                <div className="modal-body">
                    <textarea
                        ref={textareaRef}
                        className="report-textarea"
                        placeholder={placeholder}
                        value={reason}
                        onChange={e => {
                            console.log('✏️ Изменение текста:', e.target.value);
                            setReason(e.target.value);
                            if (error) setError('');
                        }}
                        rows={4}
                        disabled={isSubmitting}
                        maxLength={maxLength}
                        autoComplete="off"
                    />
                    
                    <div className="textarea-info">
                        <span className="char-count">
                            {reason.length}/{maxLength}
                        </span>
                    </div>
                    
                    {error && <div className="report-error">{error}</div>}
                </div>

                <div className="modal-actions">
                    <button 
                        className="btn-cancel" 
                        onClick={() => {
                            console.log('❌ Отмена, закрываем');
                            onClose();
                        }}
                        disabled={isSubmitting}
                    >
                        Отмена
                    </button>
                    <button 
                        className="btn-submit" 
                        onClick={handleSubmit}
                        disabled={isSubmitting || reason.trim().length < minLength}
                    >
                        {isSubmitting ? 'Отправка...' : 'Отправить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;