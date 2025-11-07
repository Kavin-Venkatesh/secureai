

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../chat.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MdDeleteOutline } from "react-icons/md";
import { FaCopy } from "react-icons/fa";
import { IoSend } from "react-icons/io5";
import axios from 'axios';
import RedactionModal from '../components/redactionModal/index';


type Sender = 'User' | 'AI';
type Msg = {
    id: string;
    sender: Sender;
    text?: string;
    timestamp: number;
    type: 'text' | 'image';
    imageUrl?: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const Conversation = () => {
    const [messages, setMessages] = useState<Msg[]>([
        { id: '1', sender: 'User', text: 'Hello, how are you?', timestamp: Date.now() - 600000, type: 'text' },
        { id: '2', sender: 'AI', text: "I'm good, thank you!", timestamp: Date.now() - 590000, type: 'text' },
        { id: '3', sender: 'User', text: 'Can you help me with my project?', timestamp: Date.now() - 580000, type: 'text' },
    ]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // Add to existing state declarations
    const [selectedImage, setSelectedImage] = useState<{ file: File; preview: string } | null>(null);

    const [isRedactionOpen, setIsRedactionOpen] = useState(false);
    const [redactionContent, setRedactionContent] = useState<{ type: 'text' | 'image'; original: string; redacted?: string }>({ type: 'text', original: '', redacted: '' });
    const [detectedPII, setDetectedPII] = useState<any[]>([]);
    const [pendingMessageId, setPendingMessageId] = useState<string | null>(null); // message_id returned by detection API
    const [pendingConversionId, setPendingConversionId] = useState<string | null>(null); // optional conversion id you may pass


    // auto-scroll to latest message
    const scrollToBottom = useCallback(() => {
        const el = containerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (selectedImage) {
            if (pendingMessageId) {
                // sendFinalImage(selectedImage, pendingMessageId, pendingConversionId ?? null);
            } else {
                detectImageBeforeSend(selectedImage);
            }
        } else {
            if (pendingMessageId && input.trim()) {
                sendFinalText(input.trim(), pendingMessageId, pendingConversionId ?? null);
            } else {
                detectTextBeforeSend(input.trim());
            }
        }
    };

    // Drag & drop handlers
    const clearHistory = () => setMessages([]);

    const deleteMessage = (id: string) => setMessages((m) => m.filter((x) => x.id !== id));

    const copyMessage = async (text?: string) => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
    };


    const downloadImage = async (url?: string) => {
        if (!url) return;
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const a = document.createElement('a');
            const blobUrl = URL.createObjectURL(blob);
            a.href = blobUrl;
            a.download = 'image.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        } catch {
            alert('Download failed.');
        }
    };

    const handleFileSelect = async (files: FileList | null) => {
        if (!files?.length) return;

        const file = files[0];

        if (!ACCEPTED_TYPES.includes(file.type)) {
            alert('Invalid file type. Please upload JPEG, PNG, GIF, or WebP images.');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert('File too large. Maximum size is 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            setSelectedImage({
                file,
                preview: e.target?.result as string
            });
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };


    const sendMessage = async (text: string) => {
        if (!text.trim() && !selectedImage) {
            alert('Please enter a message or select an image');
            return;
        }

        setIsProcessing(true);

        try {
            if (selectedImage) {
                // Create form data for image upload
                const formData = new FormData();
                formData.append('image', selectedImage.file);
                if (text.trim()) {
                    formData.append('message', text.trim());
                }

                // Add image message to UI
                const userMsg: Msg = {
                    id: String(Date.now()),
                    sender: 'User',
                    text: text.trim() || undefined,
                    timestamp: Date.now(),
                    type: 'image',
                    imageUrl: selectedImage.preview
                };
                setMessages(prev => [...prev, userMsg]);

                // Send to backend
                const response = await axios.post('/api/chat/image', formData);

                const aiMsg: Msg = {
                    id: String(Date.now() + 1),
                    sender: 'AI',
                    text: response.data.message,
                    timestamp: Date.now(),
                    type: 'text'
                };
                setMessages(prev => [...prev, aiMsg]);

                setSelectedImage(null);
            } else {
                // Text only message
                const userMsg: Msg = {
                    id: String(Date.now()),
                    sender: 'User',
                    text,
                    timestamp: Date.now(),
                    type: 'text'
                };
                setMessages(prev => [...prev, userMsg]);

                // Send to backend
                const response = await axios.post('/api/chat/text', { message: text });

                // Add AI response
                const aiMsg: Msg = {
                    id: String(Date.now() + 1),
                    sender: 'AI',
                    text: response.data.message,
                    timestamp: Date.now(),
                    type: 'text'
                };
                setMessages(prev => [...prev, aiMsg]);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsProcessing(false);
            setInput('');
        }
    };


    const detectTextBeforeSend = async (text: string) => {
        if (!text) {
            alert('Please enter a message or select an image');
            return;
        }

        try {
            setIsProcessing(true);

            // conversion_id and message_id per your backend contract
            const payload = {
                conversion_id: pendingConversionId ?? null,
                message_id: null, // initial message - null as user specified
                text
            };

            const res = await axios.post('/api/chat/detect', payload);
            // Expecting: { message_id, redacted_text, detection }
            const { message_id, redacted_text, detection } = res.data;

            // store message id for final send
            setPendingMessageId(message_id ?? null);
            setPendingConversionId(payload.conversion_id);

            // open modal with original and redacted text for user editing
            setRedactionContent({ type: 'text', original: text, redacted: redacted_text ?? text });
            setDetectedPII(Array.isArray(detection) ? detection : (detection ? [detection] : []));
            setIsRedactionOpen(true);
        } catch (err) {
            console.error('Detection error', err);
            alert('PII detection failed. Try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    // After user confirms modal for text we put redacted text into input so user can edit and then send final
    const onTextRedactionConfirm = (finalRedactedText: string) => {
        setInput(finalRedactedText);
        setIsRedactionOpen(false);
        // keep pendingMessageId so that next send uses it
    };

    // Final send for text (after user possibly edited redacted text)
    const sendFinalText = async (finalText: string, messageId: string, conversionId: string | null) => {
        if (!finalText) {
            alert('Please enter a message');
            return;
        }

        setIsProcessing(true);
        try {
            // add user message to UI showing the edited/redacted text
            const userMsg: Msg = {
                id: String(Date.now()),
                sender: 'User',
                text: finalText,
                timestamp: Date.now(),
                type: 'text'
            };
            setMessages(prev => [...prev, userMsg]);

            // create AI thinking placeholder and disable send button
            const thinkingId = `ai-thinking-${Date.now()}`;
            const thinkingMsg: Msg = {
                id: thinkingId,
                sender: 'AI',
                text: 'Thinking...',
                timestamp: Date.now(),
                type: 'text'
            };
            setMessages(prev => [...prev, thinkingMsg]);

            // send final to backend - include conversion_id and message_id (from detection)
            const payload = {
                conversion_id: conversionId,
                message_id: messageId,
                text: finalText
            };
            const res = await axios.post('/api/chat/text', payload);

            // replace thinking message with actual AI response
            setMessages(prev => prev.map(m => m.id === thinkingId ? ({
                id: String(Date.now() + 1),
                sender: 'AI',
                text: res.data.message,
                timestamp: Date.now(),
                type: 'text'
            }) : m));

            // clear pending message id and input
            setPendingMessageId(null);
            setPendingConversionId(null);
            setInput('');
        } catch (err) {
            console.error('Send text error', err);
            alert('Failed to send message.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Image detection -> backend returns message_id and redacted image URL (and optionally detection meta)
    const detectImageBeforeSend = async (img: { file: File; preview: string }) => {
        try {
            setIsProcessing(true);
            const formData = new FormData();
            formData.append('conversion_id', pendingConversionId ?? '');
            formData.append('message_id', 'null'); // per contract for initial
            formData.append('image', img.file);

            const res = await axios.post('/api/chat/detect-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Expecting: { message_id, redacted_image_url, detection }
            const { message_id, redacted_image_url, detection } = res.data;

            setPendingMessageId(message_id ?? null);
            setDetectedPII(Array.isArray(detection) ? detection : (detection ? [detection] : []));

            setRedactionContent({ type: 'image', original: img.preview, redacted: redacted_image_url });
            setIsRedactionOpen(true);
        } catch (err) {
            console.error('Image detection failed', err);
            alert('Image PII detection failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    // When user confirms redacted image we send image (the backend may accept redacted image URL or we call final image send)
    const onImageRedactionConfirmAndSend = async (redactedImageUrlOrData: string) => {
        if (!selectedImage) {
            setIsRedactionOpen(false);
            return;
        }

        setIsRedactionOpen(false);
        setIsProcessing(true);

        // show user image in UI immediately
        const userMsg: Msg = {
            id: String(Date.now()),
            sender: 'User',
            timestamp: Date.now(),
            type: 'image',
            imageUrl: redactedImageUrlOrData // show the redacted preview (backend returned URL)
        };
        setMessages(prev => [...prev, userMsg]);

        // show AI thinking placeholder
        const thinkingId = `ai-thinking-${Date.now()}`;
        const thinkingMsg: Msg = {
            id: thinkingId,
            sender: 'AI',
            text: 'Thinking...',
            timestamp: Date.now(),
            type: 'text'
        };
        setMessages(prev => [...prev, thinkingMsg]);

        try {
            // If backend requires us to upload the (original) file for final processing, send file + message ids.
            // Here we prefer to send form with reference to message_id returned by detection endpoint.
            const formData = new FormData();
            formData.append('conversion_id', pendingConversionId ?? '');
            formData.append('message_id', pendingMessageId ?? '');
            // If your backend expects the redacted image to be fetched from a URL, send that url
            // otherwise, send the original file (it may already have been processed on server during detection)
            // We'll send the original file as fallback:
            formData.append('image', selectedImage.file);

            const res = await axios.post('/api/chat/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // replace thinking with AI response
            setMessages(prev => prev.map(m => m.id === thinkingId ? ({
                id: String(Date.now() + 1),
                sender: 'AI',
                text: res.data.message,
                timestamp: Date.now(),
                type: 'text'
            }) : m));

            // clear selection and pending ids
            setSelectedImage(null);
            setPendingMessageId(null);
            setPendingConversionId(null);
        } catch (err) {
            console.error('Final image send failed', err);
            alert('Failed to send image.');
            // remove user image or update UI as necessary
        } finally {
            setIsProcessing(false);
        }
    };

    // Final handler passed to modal
    const handleModalConfirm = (redactedContent: string) => {
        if (redactionContent.type === 'text') {
            onTextRedactionConfirm(redactedContent);
        } else {
            // For images, redactedContent is expected to be a URL returned by detection API.
            onImageRedactionConfirmAndSend(redactedContent);
        }
    };







    return (
        <div className={styles.chatMainContainer}>
            <div className={styles.toolbar}>
                <button onClick={clearHistory}>Clear Chat <MdDeleteOutline /></button>
            </div>

            <div
                className={styles.chatMessagesContainer}
                ref={containerRef}
            >
                {messages.map((m) => (
                    <div key={m.id} className={`${styles.chatMessage} ${m.sender === 'User' ? styles.userMessage : styles.aiMessage}`}>
                        <div className={styles.messageHeader}>
                            <span className={styles.messageSender}>{m.sender}</span>
                            <span className={styles.messageTime}>{formatTime(m.timestamp)}</span>
                        </div>

                        <div className={styles.messageBody}>
                            {m.text && (
                                <div className={styles.messageText}>
                                    {m.sender === 'AI' ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                                    ) : (
                                        <span>{m.text}</span>
                                    )}
                                </div>
                            )}
                            {m.type === 'image' && m.imageUrl && (
                                <div className={styles.imageWrapper}>
                                    <img src={m.imageUrl} alt="uploaded" className={styles.previewImage} />
                                    <div className={styles.imageActions}>
                                        <button onClick={() => downloadImage(m.imageUrl)}>Download</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.messageControls} >
                            {m.sender === 'User' && (
                                <button onClick={() => deleteMessage(m.id)}><MdDeleteOutline /></button>
                            )}
                            <button onClick={() => copyMessage(m.text)}><FaCopy /></button>
                        </div>

                    </div>
                ))}

                {Object.entries(uploadProgress).map(([id, p]) => (
                    <div key={id} className={styles.uploadProgress}>
                        Uploading... {p}%
                    </div>
                ))}

                {isProcessing && (
                    <div className={styles.chatMessage}>
                        <span className={styles.messageSender}>AI:</span>
                        <span className={styles.messageText}>AI is typing...</span>
                    </div>
                )}
            </div>

            {selectedImage && (
                <div className={styles.selectedImagePreview}>
                    <img src={selectedImage.preview} alt="Selected" />
                    <button onClick={() => setSelectedImage(null)}>×</button>
                </div>
            )}


            <form
                className={styles.inputContainer}
                onSubmit={handleSend}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <button
                    type="button"
                    className={styles.uploadFiles}
                    onClick={() => fileInputRef.current?.click()}
                >
                    +
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileSelect(e.target.files)}
                />
                <input
                    type="text"
                    className={styles.chatInput}
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button
                    className={styles.sendButton}
                    type="submit"
                    disabled={isProcessing}
                >
                    {isProcessing ? '...' : <IoSend />}
                </button>
            </form>


            <RedactionModal
                isOpen={isRedactionOpen}
                onClose={() => setIsRedactionOpen(false)}
                content={redactionContent}
                detectedPII={detectedPII}
                onConfirm={handleModalConfirm}
            />


        </div>
    );
}

export default Conversation;