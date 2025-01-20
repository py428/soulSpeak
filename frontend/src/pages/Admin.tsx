import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface Question {
    _id: string;
    question: string;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    correct: string;
    resource: string;
}

interface Report {
    _id: string;
    userEmail: string;
    timestamp: Date;
    type: 'review' | 'profile-report' | 'chat-report';
    details: string;
    status: 'pending' | 'resolved' | 'rejected';
}


interface User {
    _id: string;
    username: string;
    email: string;
    isCompanion: boolean;
}

interface SuspensionStatus {
    email: string;
    isSuspended: boolean;
}


const Admin = () => {
    const [searchEmail, setSearchEmail] = useState('');
    const [suspensionStatus, setSuspensionStatus] = useState<SuspensionStatus | null>(null);

    const [activeTab, setActiveTab] = useState('questions');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [formData, setFormData] = useState({
        question: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correct: '',
        resource: ''
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [reports, setReports] = useState<Report[]>([]);

    const fetchReports = async () => {
        const token = localStorage.getItem("token");
        const response = await axios.get('http://localhost:5000/reports', {
            headers: { Authorization: `Bearer ${token}` }
        });
        setReports(response.data);
    };

    const generatePDF = () => {
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(16);
        doc.text('Reports Summary', 14, 15);

        // Define the table columns and rows
        const tableColumn = ["Email", "Type", "Details", "Time", "Status"];
        const tableRows = reports.map(report => [
            report.userEmail,
            report.type,
            report.details,
            new Date(report.timestamp).toLocaleString(),
            report.status
        ]);

        // Generate the table
        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 25,
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 30 },
                2: { cellWidth: 50 },
                3: { cellWidth: 35 },
                4: { cellWidth: 25 }
            }
        });

        // Save the PDF
        doc.save('reports.pdf');
    };
    useEffect(() => {
        if (activeTab === 'questions') {
            fetchQuestions();
        } else if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'reports') {
            fetchReports();
        }
    }, [activeTab]);

    const handleUpdateStatus = async (reportId: string, newStatus: 'resolved' | 'rejected') => {
        const token = localStorage.getItem("token");
        await axios.patch(
            `http://localhost:5000/admin/reports/${reportId}/status`,
            { status: newStatus },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchReports();
    };
    const handleActivateUser = async () => {
        const token = localStorage.getItem("token");
        try {
            await axios.post(`http://localhost:5000/admin/activate`, {
                email: searchEmail,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            checkSuspensionStatus();
        } catch (error) {
            console.error('Error activating user:', error);
        }
    };

    const fetchQuestions = async () => {
        const response = await axios.get('http://localhost:5000/admin/questions');
        setQuestions(response.data);
    };

    const fetchUsers = async () => {
        const token = localStorage.getItem("token");
        const response = await axios.get('http://localhost:5000/admin/users', {
            headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem("token");

        if (editingId) {
            await axios.put(`http://localhost:5000/admin/questions/${editingId}`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } else {
            await axios.post('http://localhost:5000/admin/questions', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
        }
        setFormData({
            question: '',
            option1: '',
            option2: '',
            option3: '',
            option4: '',
            correct: '',
            resource: ''
        });
        setEditingId(null);
        fetchQuestions();
    };

    const handleDelete = async (id: string) => {
        const token = localStorage.getItem("token");
        await axios.delete(`http://localhost:5000/admin/questions/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchQuestions();
    };

    const handleEdit = (question: Question) => {
        setFormData({
            question: question.question,
            option1: question.option1,
            option2: question.option2,
            option3: question.option3,
            option4: question.option4,
            correct: question.correct,
            resource: question.resource
        });
        setEditingId(question._id);
    };
    const checkSuspensionStatus = async () => {
        console.log('Checking suspension status for:', searchEmail);
        const token = localStorage.getItem("token");
        try {
            const response = await axios.get(`http://localhost:5000/admin/suspension/${searchEmail}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(response.data);
            setSuspensionStatus(response.data);
        } catch (error) {
            console.error('Error fetching suspension status:', error);
        }
    };

    const handleSuspendUser = async () => {
        const token = localStorage.getItem("token");
        try {
            await axios.post(`http://localhost:5000/admin/suspend`, {
                email: searchEmail,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            checkSuspensionStatus();
        } catch (error) {
            console.error('Error suspending user:', error);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#E8EAEB]">
            {/* Sidebar */}
            <div className="w-72 bg-[#4D6A6D] shadow-xl">
                <div className="p-6">
                    <h2 className="text-2xl font-bold text-white mb-8">Admin Panel</h2>
                    <nav className="space-y-3">
                        {['questions', 'users', 'reports', 'suspension'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`w-full text-left px-5 py-3 rounded-lg transition-all duration-200 ${activeTab === tab
                                        ? 'bg-white text-[#4D6A6D] shadow-lg font-semibold'
                                        : 'text-white hover:bg-[#5A7D80] hover:shadow-md'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)} Management
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
                {/* Questions Tab */}
                {activeTab === 'questions' && (
                    <>
                        <h1 className="text-3xl font-bold mb-8 text-[#2C3E50]">Questions Management</h1>
                        <form onSubmit={handleSubmit} className="mb-8 space-y-4 bg-white p-6 rounded-xl shadow-md">
                            {['question', 'option1', 'option2', 'option3', 'option4', 'correct', 'resource'].map((field) => (
                                <input
                                    key={field}
                                    type="text"
                                    name={field}
                                    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                                    value={formData[field as keyof typeof formData]}
                                    onChange={handleInputChange}
                                    className="w-full p-3 border-2 border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#4D6A6D] bg-white text-[#2C3E50] placeholder-[#94A3B8] transition-colors"
                                />
                            ))}
                            <button
                                type="submit"
                                className="bg-[#4D6A6D] hover:bg-[#3D5457] text-white px-6 py-3 rounded-lg transition-colors duration-200 font-semibold shadow-md hover:shadow-lg"
                            >
                                {editingId ? 'Update Question' : 'Add Question'}
                            </button>
                        </form>
                        <div className="space-y-6">
                            {questions.map((question) => (
                                <div key={question._id} className="border-2 border-[#CBD5E1] p-6 rounded-xl bg-white shadow-md hover:shadow-lg transition-shadow duration-200">
                                    <h3 className="text-xl font-bold text-[#2C3E50] mb-4">{question.question}</h3>
                                    <div className="ml-4 text-[#4A5568] space-y-2">
                                        <p className="font-medium">1. {question.option1}</p>
                                        <p className="font-medium">2. {question.option2}</p>
                                        <p className="font-medium">3. {question.option3}</p>
                                        <p className="font-medium">4. {question.option4}</p>
                                        <p className="font-semibold text-[#4D6A6D]">Answer: {question.correct}</p>
                                        <p className="text-[#4D6A6D]">Resource: {question.resource}</p>
                                    </div>
                                    <div className="mt-4 space-x-3">
                                        <button
                                            onClick={() => handleEdit(question)}
                                            className="bg-[#64748B] hover:bg-[#475569] text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(question._id)}
                                            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <>
                        <h1 className="text-3xl font-bold mb-8 text-[#2C3E50]">User Management</h1>
                        <div className="bg-white shadow-md rounded-xl border-2 border-[#CBD5E1] overflow-hidden">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-[#F8FAFC]">
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Username</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Email</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Role</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-[#CBD5E1]">
                                    {users.map((user) => (
                                        <tr key={user._id} className="hover:bg-[#F8FAFC] transition-colors duration-150">
                                            <td className="px-6 py-4 text-[#2C3E50] font-medium">{user.username}</td>
                                            <td className="px-6 py-4 text-[#4A5568]">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${user.isCompanion
                                                        ? 'bg-[#4D6A6D] text-white'
                                                        : 'bg-[#CBD5E1] text-[#2C3E50]'
                                                    }`}>
                                                    {user.isCompanion ? "Companion" : "User"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Reports Tab */}
                {activeTab === 'reports' && (
                    <>

                        <h1 className="text-3xl font-bold mb-8 text-[#2C3E50]">Reports Management</h1>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={generatePDF}
                                className="bg-[#4D6A6D] hover:bg-[#3D5457] text-white px-6 py-3 rounded-lg transition-colors duration-200 font-semibold shadow-md hover:shadow-lg"
                            >
                                Generate PDF Report
                            </button>
                        </div>
                        <div className="bg-white shadow-md rounded-xl border-2 border-[#CBD5E1] overflow-hidden">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-[#F8FAFC]">
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Email</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Type</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Details</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Time</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Status</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#2C3E50] uppercase tracking-wider border-b-2 border-[#CBD5E1]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-[#CBD5E1]">
                                    {reports.map((report) => (
                                        <tr key={report._id} className="hover:bg-[#F8FAFC] transition-colors duration-150">
                                            <td className="px-6 py-4 text-[#2C3E50] font-medium">{report.userEmail}</td>
                                            <td className="px-6 py-4 text-[#4A5568]">{report.type}</td>
                                            <td className="px-6 py-4 text-[#4A5568]">{report.details}</td>
                                            <td className="px-6 py-4 text-[#4A5568]">
                                                {new Date(report.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${report.status === 'pending' ? 'bg-[#FCD34D] text-[#92400E]' :
                                                        report.status === 'resolved' ? 'bg-[#34D399] text-[#065F46]' :
                                                            'bg-[#F87171] text-[#991B1B]'
                                                    }`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleUpdateStatus(report._id, 'resolved')}
                                                    className="bg-[#34D399] hover:bg-[#059669] text-white px-3 py-2 rounded-lg mr-2 transition-colors duration-200 font-medium"
                                                >
                                                    Resolve
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(report._id, 'rejected')}
                                                    className="bg-[#F87171] hover:bg-[#DC2626] text-white px-3 py-2 rounded-lg transition-colors duration-200 font-medium"
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Suspension Tab */}
                {activeTab === 'suspension' && (
                    <>
                        <h1 className="text-3xl font-bold mb-8 text-[#2C3E50]">User Suspension Management</h1>
                        <div className="bg-white shadow-md rounded-xl border-2 border-[#CBD5E1] p-8">
                            <div className="flex gap-4 mb-8">
                                <input
                                    type="email"
                                    value={searchEmail}
                                    onChange={(e) => setSearchEmail(e.target.value)}
                                    placeholder="Enter user email"
                                    className="flex-1 p-3 border-2 border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#4D6A6D] text-[#2C3E50] placeholder-[#94A3B8] transition-colors"
                                />
                                <button
                                    onClick={checkSuspensionStatus}
                                    className="bg-[#4D6A6D] hover:bg-[#3D5457] text-white px-6 py-3 rounded-lg transition-colors duration-200 font-semibold shadow-md hover:shadow-lg"
                                >
                                    Check Status
                                </button>
                            </div>

                            { suspensionStatus && (
                                <div className="mt-6 p-6 bg-[#F8FAFC] rounded-lg border-2 border-[#CBD5E1]">
                                    <div className="mb-6">
                                        <p className="text-lg font-semibold text-[#2C3E50] mb-2">Status for {suspensionStatus.email}:</p>
                                        <p className={`text-lg font-bold ${suspensionStatus.isSuspended ? 'text-[#DC2626]' : 'text-[#059669]'
                                            }`}>
                                            {suspensionStatus.isSuspended ? 'Suspended' : 'Active'}
                                        </p>
                                    </div>
                                    <div className="space-x-4">
                                        {!suspensionStatus.isSuspended ? (
                                            <button
                                                onClick={handleSuspendUser}
                                                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-6 py-3 rounded-lg transition-colors duration-200 font-semibold shadow-md hover:shadow-lg"
                                            >
                                                Suspend User
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleActivateUser}
                                                className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-3 rounded-lg transition-colors duration-200 font-semibold shadow-md hover:shadow-lg"
                                            >
                                                Activate User
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Admin;
