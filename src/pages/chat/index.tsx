import styles from './chat.module.css';
import Header from './components/header';
import Sidebar from './components/sidebar';
import Conversation from './components/conversation';

const ChatPage = () => {
    return (
        <div className={styles.mainContainer}>
            <Header />
           <div className={styles.chatContainer}>
               <Sidebar />  
                <Conversation />
           </div>
        </div> 
    );
}
export default ChatPage;
