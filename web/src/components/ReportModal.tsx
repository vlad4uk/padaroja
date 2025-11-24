import React, { useState } from 'react';
import './ReportModal.css'; // Стили ниже

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!reason.trim()) {
            setError('Пожалуйста, укажите причину жалобы.');
            return;
        }
        onSubmit(reason);
        setReason(''); // Очистка
        setError('');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Пожаловаться на публикацию</h3>
                <p>Опишите причину жалобы. Модераторы проверят этот контент.</p>
                
                <textarea
                    className="report-textarea"
                    placeholder="Причина жалобы (спам, оскорбления, ложная информация...)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                />
                
                {error && <div className="report-error">{error}</div>}

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onClose}>Отмена</button>
                    <button className="btn-submit" onClick={handleSubmit}>Отправить</button>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;