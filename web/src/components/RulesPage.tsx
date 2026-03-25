import React from 'react';
import ContentLayout from './ContentLayout.tsx';
import './RulesPage.css';

const RulesPage: React.FC = () => {
    return (
        <ContentLayout>
            <div className="rules-container">
                <h1 className="rules-title">Правила сообщества</h1>
                
                <div className="rules-content">
                    <section className="rules-section">
                        <h2 className="rules-section-title">Основные правила</h2>
                        <ul className="rules-list">
                            <li className="rules-item">
                                <strong>Уважайте других пользователей</strong> - Общайтесь вежливо и культурно, даже при наличии разногласий.
                            </li>
                            <li className="rules-item">
                                <strong>Запрещены оскорбления и угрозы</strong> - Не допускаются личные нападки, дискриминация по любым признакам.
                            </li>
                            <li className="rules-item">
                                <strong>Конфиденциальность</strong> - Не публикуйте личную информацию других людей без их согласия.
                            </li>
                        </ul>
                    </section>

                    <section className="rules-section">
                        <h2 className="rules-section-title">Запрещенный контент</h2>
                        <ul className="rules-list">
                            <li className="rules-item">
                                <strong>Ненормативная лексика</strong> - Маты, ругательства и обсценная лексика запрещены.
                            </li>
                            <li className="rules-item">
                                <strong>Порнография и эротика</strong> - Контент для взрослых, откровенные изображения.
                            </li>
                            <li className="rules-item">
                                <strong>Насилие и жестокость</strong> - Изображения или описания насилия, жестокого обращения.
                            </li>
                            <li className="rules-item">
                                <strong>Пропаганда и экстремизм</strong> - Распространение экстремистских материалов.
                            </li>
                            <li className="rules-item">
                                <strong>Мошенничество и спам</strong> - Обманные схемы, реклама, накрутка.
                            </li>
                        </ul>
                    </section>

                    <section className="rules-section">
                        <h2 className="rules-section-title">Правила для публикаций</h2>
                        <ul className="rules-list">
                            <li className="rules-item">
                                <strong>Авторские права</strong> - Публикуйте только контент, который создали сами или имеете право использовать.
                            </li>
                            <li className="rules-item">
                                <strong>Качество контента</strong> - Избегайте размытых, нечитаемых или низкокачественных изображений.
                            </li>
                            <li className="rules-item">
                                <strong>Релевантность</strong> - Публикуйте контент, соответствующий тематике сообщества.
                            </li>
                        </ul>
                    </section>

                    <section className="rules-section">
                        <h2 className="rules-section-title">Нарушения и модерация</h2>
                        <ul className="rules-list">
                            <li className="rules-item">
                                <strong>Модерация</strong> - Администраторы и модераторы могут удалять контент, нарушающий правила.
                            </li>
                            <li className="rules-item">
                                <strong>Блокировка</strong> - За грубые или повторные нарушения возможна блокировка аккаунта.
                            </li>
                            <li className="rules-item">
                                <strong>Апелляции</strong> - Если считаете, что ваша блокировка несправедлива, обратитесь в поддержку.
                            </li>
                        </ul>
                    </section>
                </div>
            </div>
        </ContentLayout>
    );
};

export default RulesPage;