import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { format } from 'date-fns';
import { AlertCircle, Send, Loader } from 'lucide-react';

interface Message {
    _id: string;
    content: string;
    sender: string;
    timestamp: string;
}

interface User {
    _id: string;
    username: string;
    isOnline?: boolean;
    isCompanion: boolean;
}

interface Chat {
    _id: string;
    participants: User[];
    messages: Message[];
    lastMessage?: Message;
}

interface TypingStatus {
    chatId: string;
    userId: string;
    username: string;
}

const Chat: React.FC = () => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [currentChat, setCurrentChat] = useState<Chat | null>(null);
    const [message, setMessage] = useState('');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typingStatus, setTypingStatus] = useState<TypingStatus | null>(null);
    const [showCompanions, setShowCompanions] = useState(false);
    const [companions, setCompanions] = useState<User[]>([]);
    const socket = useRef<any>();
    const messageEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>();
    const currentChatRef = useRef<Chat | null>(null);

    const fetchCompanions = async () => {
        try {
            const response = await axios.get("http://localhost:5000/companions");
            setCompanions(response.data);
        } catch (error) {
            setError('Failed to fetch companions');
        }
    };
    const startCompanionChat = async (companionId: string) => {
        try {
            const response = await axios.post(
                "http://localhost:5000/chat/create",
                { participantId: companionId },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );
            
            // Set current chat immediately
            setCurrentChat(response.data);
            
            // Add to chats list if not already present
            setChats(prevChats => {
                const chatExists = prevChats.some(chat => chat._id === response.data._id);
                if (chatExists) {
                    return prevChats;
                }
                return [...prevChats, response.data];
            });
            
            setShowCompanions(false);
        } catch (error) {
            setError('Failed to start chat with companion');
        }
    };
    

    useEffect(() => {
        initializeChat();
        return () => {
            socket.current?.disconnect();
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        scrollToBottom();

    }, [currentChat?.messages]);


useEffect(() => {
    currentChatRef.current = currentChat; // Keep the ref updated
}, [currentChat]);

    useEffect(() => {
        if (currentChat?._id && socket.current) {
            console.log('Joining chat room:', currentChat._id);
            socket.current.emit('join', currentChat._id);
        }
    }, [currentChat]);
    
    const initializeChat = async () => {
        try {
            setIsLoading(true);
            await fetchCurrentUser();
            await fetchChats();
            initializeSocket();
        } catch (err) {
            setError('Failed to initialize chat. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const initializeSocket = () => {
        socket.current = io('http://localhost:5000', {
            auth: {
                token: localStorage.getItem('token')
            }
        });

        socket.current.on('newChat', (chat) => {
            console.log('New chat received:', chat);
            setChats(prevChats => {
                // Check if chat already exists
                const exists = prevChats.some(existingChat => 
                    existingChat._id === chat._id
                );
                
                if (!exists) {
                    return [...prevChats, chat];
                }
                
                // Update existing chat if it exists
                return prevChats.map(existingChat => 
                    existingChat._id === chat._id ? chat : existingChat
                );
            });
        });

        socket.current.on('newMessage', ({ chatId, message }) => {
            console.log('New message received:', { chatId, message });
            updateChatWithNewMessage(chatId, message);
        });
    };

    const fetchCurrentUser = async () => {
        try {
            const response = await axios.get("http://localhost:5000/profile", {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setCurrentUser(response.data.user);
            console.log(response.data.user);
        } catch (error) {
            throw new Error('Failed to fetch user data');
        }
    };

    const fetchChats = async () => {
        try {
            const response = await axios.get<Chat[]>("http://localhost:5000/chat/", {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setChats(response.data);
            console.log(response.data);
        } catch (error) {
            throw new Error('Failed to fetch chats');
        }
    };

    const updateChatWithNewMessage = (chatId: string, message: Message) => {
        const activeChat = currentChatRef.current;

    console.log('Message update triggered');
    console.log('Active chat state:', activeChat);
    console.log('Incoming chatId:', chatId);
    console.log('Incoming message:', message);

        setChats(prevChats =>
            prevChats.map(chat =>
                chat._id === chatId
                    ? { ...chat, messages: [...chat.messages, message], lastMessage: message }
                    : chat
            )
        );

        if (activeChat?._id === chatId) {
            console.log('Received new message:', message);
            setCurrentChat(prev => ({
                ...prev!,
                messages: [...prev!.messages, message],
                lastMessage: message
            }));
        }
    };

    const handleMessageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value);
        if (currentChat) {
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Emit typing status
            socket.current.emit('typing', {
                chatId: currentChat._id,
                userId: currentUser?._id,
                username: currentUser?.username
            });

            // Set new timeout to stop typing
            typingTimeoutRef.current = setTimeout(() => {
                socket.current.emit('stopTyping', currentChat._id);
            }, 2000);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !currentChat || !currentUser) return;

        try {
            const response = await axios.post(
                "http://localhost:5000/chat/send",
                {
                    chatId: currentChat._id,
                    content: message
                },
                {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                }
            );
            console.log(response.data);
            setMessage('');
            socket.current.emit('stopTyping', currentChat._id);
        } catch (error) {
            setError('Failed to send message. Please try again.');
        }
    };

    const scrollToBottom = () => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#4C5B61]">
                <Loader className="w-8 h-8 animate-spin text-[#C5C5C5]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#4C5B61]">
                <div className="flex items-center space-x-2 text-[#C5C5C5]">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#2C3E50]">
            {/* Chat list */}
            <div className="w-1/3 border-r border-[#7F8C8D] bg-[#34495E] overflow-y-auto">
                <div className="p-4 border-b border-[#7F8C8D]">
                    <h2 className="text-xl font-semibold text-[#ECF0F1]">Chats</h2>
                    {currentUser && !currentUser.isCompanion && (
                        <button
                            onClick={() => {
                                setShowCompanions(true);
                                fetchCompanions();
                            }}
                            className="mt-2 w-full py-2 px-4 bg-[#1ABC9C] text-white rounded-lg hover:bg-[#16A085] transition-colors"
                        >
                            Find Companions
                        </button>
                    )}
                </div>
                {showCompanions ? (
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-[#ECF0F1]">Available Companions</h3>
                            <button
                                onClick={() => setShowCompanions(false)}
                                className="text-[#ECF0F1] hover:text-[#BDC3C7]"
                            >
                                Back to Chats
                            </button>
                        </div>
                        {companions.map(companion => (
                            <div
                                key={companion._id}
                                className="p-4 border-b border-[#7F8C8D] hover:bg-[#2C3E50] cursor-pointer transition-colors"
                                onClick={() => startCompanionChat(companion._id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-[#ECF0F1]">{companion.username}</p>
                                        <p className="text-sm text-[#BDC3C7]">Companion</p>
                                    </div>
                                    {companion.isOnline && (
                                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    chats.map(chat => {
                        const otherParticipant = chat.participants.find(
                            p => p._id !== currentUser?._id
                        );
                        return (
                            <div
                                key={chat._id}
                                onClick={() => setCurrentChat(chat)}
                                className={`p-4 hover:bg-[#2C3E50] cursor-pointer border-b border-[#7F8C8D] transition-colors ${
                                    currentChat?._id === chat._id ? 'bg-[#2C3E50]' : ''
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-[#ECF0F1]">
                                        {otherParticipant?.username}
                                    </span>
                                    {chat.lastMessage && (
                                        <span className="text-xs text-[#BDC3C7]">
                                            {format(new Date(chat.lastMessage.timestamp || Date.now()), 'HH:mm')}
                                        </span>
                                    )}
                                </div>
                                {chat.lastMessage && (
                                    <p className="text-sm text-[#BDC3C7] truncate">
                                        {chat.lastMessage.content}
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
    
            {/* Chat messages */}
            <div className="w-2/3 flex flex-col bg-[#34495E]">
                {currentChat ? (
                    <>
                        <div className="p-4 border-b border-[#7F8C8D]">
                            <h3 className="text-lg font-semibold text-[#ECF0F1]">
                                {currentChat.participants.find(
                                    p => p._id !== currentUser?._id
                                )?.username} <span className='text-xs'>(Chat ID: {currentChat._id})</span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {currentChat.messages.map(msg => (
                                <div
                                    key={msg._id}
                                    className={`my-2 max-w-[70%] ${
                                        msg.sender === currentUser?._id ? 'ml-auto' : ''
                                    }`}
                                >
                                    <div
                                        className={`p-3 rounded-lg ${
                                            msg.sender === currentUser?._id
                                                ? 'bg-[#1ABC9C] text-white'
                                                : 'bg-[#2C3E50] text-[#ECF0F1]'
                                        }`}
                                    >
                                        {msg.content}
                                    </div>
                                    <div
                                        className={`text-xs text-[#BDC3C7] mt-1 ${
                                            msg.sender === currentUser?._id ? 'text-right' : ''
                                        }`}
                                    >
                                        {format(new Date(msg.timestamp || Date.now()), 'HH:mm')}
                                    </div>
                                </div>
                            ))}
                            {typingStatus && typingStatus.chatId === currentChat._id && (
                                <div className="text-sm text-[#BDC3C7] italic">
                                    {typingStatus.username} is typing...
                                </div>
                            )}
                            <div ref={messageEndRef} />
                        </div>
                        <form onSubmit={sendMessage} className="p-4 border-t border-[#7F8C8D]">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={message}
                                    onChange={handleMessageInput}
                                    className="flex-1 p-2 border border-[#7F8C8D] rounded-lg bg-[#2C3E50] text-[#ECF0F1] placeholder-[#BDC3C7] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                                    placeholder="Type a message..."
                                />
                                <button
                                    type="submit"
                                    disabled={!message.trim()}
                                    className="p-2 bg-[#1ABC9C] text-white rounded-lg hover:bg-[#16A085] disabled:opacity-50 transition-colors"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[#BDC3C7]">
                        Select a chat to start messaging
                    </div>
                )}
            </div>
        </div>
    );
    
};

export default Chat;