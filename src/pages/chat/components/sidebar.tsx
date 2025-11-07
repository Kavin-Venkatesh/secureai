import { useState } from 'react';
import styles from '../chat.module.css';

type Conversation = {
    id: string;
    name: string;
};

const Sidebar = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>('1');
    const [conversations] = useState<Conversation[]>([
        { id: '1', name: 'Conversation 1' },
        { id: '2', name: 'Conversation 2' },
        { id: '3', name: 'Conversation 3' },
        { id: '4', name: 'Support Chat' },
        { id: '5', name: 'Project Planning' }
    ]);

    const toggleSidebar = () => setIsExpanded((s) => !s);

    return (
        <aside
            className={`${styles.sidebar} ${isExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed}`}
            aria-expanded={isExpanded}
        >
            <div className={styles.sidebarTop}>
                <button
                    onClick={toggleSidebar}
                    className={styles.toggleButton}
                    aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    {isExpanded ? '‹' : '›'}
                </button>

                {isExpanded && <h2 className={styles.sidebarTitle}>Chats</h2>}

                {isExpanded && (
                    <button className={styles.newChatButton} title="New chat" aria-label="New chat">
                        +
                    </button>
                )}
            </div>

            <div className={styles.conversationsContainer} role="list">
                {conversations.map((c) => {
                    const selected = c.id === selectedId;
                    return (
                        <button
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            className={`${styles.conversation} ${selected ? styles.selected : ''}`}
                            role="listitem"
                            aria-pressed={selected}
                            title={c.name}
                        >
                            <div className={styles.conversationName} aria-hidden={!isExpanded}>
                                {isExpanded ? c.name : c.name.charAt(0)}
                            </div>
                            {isExpanded && <div className={styles.conversationId}>#{c.id}</div>}
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};

export default Sidebar;
