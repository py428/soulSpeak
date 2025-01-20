import User from "../models/userModel.js";
import Question from "../models/questionModel.js";
import Report from "../models/Report.js";
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS
  }
});

export async function get_all_questions(request, response) {
    try {
        const questions = await Question.find();
        return response.status(200).json(questions);
    } catch (error) {
        console.error("Error fetching questions:", error);
        return response.status(500).json({ message: "Internal server error." });
    }
}

export async function add_companion_test_question(request, response) {
    console.log("Received request to add a question");
    try {
        const body = await request.body
        const { question, option1, option2, option3, option4, correct, resource } = body;
        if (!question || !option1 || !option2 || !option3 || !option4 || !correct || !resource) {
            return response.status(400).json({ message: "All fields are required." });
        }
        const user = await User.findById(request.user.id);
        console.log(user)
        if (!user) {
            return response.status(401).json({ message: "User not found." });
        }
        if (!(user.email === "admin@gmail.com")) {
            return response.status(403).json({ message: "You are not authorized to add questions." });
        }
        const newQuestion = new Question({
            question,
            option1,
            option2,
            option3,
            option4,
            correct,
            resource,
        });
        await newQuestion.save();
        console.log("Question added successfully:", newQuestion);
        return response.status(201).json({ message: "Question added successfully." });
    } catch (error) {
        console.error("Error during signup:", error);
        return response.status(500).json({ message: "Internal server error." });
    }
}

export async function delete_question(request, response) {
    console.log("Received request to delete a question");
    try {
        const { id } = request.params;  
        const user = await User.findById(request.user.id);
        if (!user) {
            return response.status(401).json({ message: "User not found." });
        }
        if (!(user.email === "admin@gmail.com")) {
            return response.status(403).json({ message: "You are not authorized to delete questions." });
        }
        const deletedQuestion = await Question.findByIdAndDelete(id);
        if (!deletedQuestion) {
            return response.status(404).json({ message: "Question not found." });
        }
        return response.status(200).json({ message: "Question deleted successfully." });
    } catch (error) {
        console.error("Error deleting question:", error);  // Updated error message
        return response.status(500).json({ message: "Internal server error." });
    }
}

export async function update_question(request, response){
    try {
        const { id } = request.params;  // Get id from params
        const { question, option1, option2, option3, option4, correct, resource } = request.body;  // Remove _id from body
        const user = await User.findById(request.user.id);
        if (!user) {
            return response.status(401).json({ message: "User not found." });
        }
        if (!(user.email === "admin@gmail.com")) {
            return response.status(403).json({ message: "You are not authorized to update questions." });
        }
        const updatedQuestion = await Question.findByIdAndUpdate(
            id,  
            {
                question,
                option1,
                option2,
                option3,
                option4,
                correct,
                resource,
            },
            { new: true }
        );
        if (!updatedQuestion) {
            return response.status(404).json({ message: "Question not found." });
        }
        return response.status(200).json({ message: "Question updated successfully." });
    } catch (error) {
        console.error("Error updating question:", error);  // Updated error message
        return response.status(500).json({ message: "Internal server error." });
    }
}

export async function get_all_users (request, response){
    try {
        const admin = await User.findById(request.user.id);
        if (!admin) {
            return response.status(401).json({ message: "Admin not found." });
        }
        const users = await User.find();
        return response.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return response.status(500).json({ message: "Internal server error." });
    }
};


export async function suspend(request, response) {
    try {
        const admin = await User.findById(request.user.id);
        if (!admin) {
            return response.status(401).json({ message: "Admin not found." });
        }
        const { email, reason } = request.body;
        await User.findOneAndUpdate(
            { email },
            { suspended: true },
            { new: true }
        );
        return response.status(200).json({ message:  'suspended successfully.'});
    } catch (error) {
        console.error("Error suspending/unsuspending user:", error);
    }
}
export async function activate(request, response) {
    try {
        const admin = await User.findById(request.user.id);
        if (!admin) {
            return response.status(401).json({ message: "Admin not found." });
        }
        const { email, reason } = request.body;
        await User.findOneAndUpdate(
            { email },
            { suspended: false },
            { new: true }
        );
        return response.status(200).json({ message:  'suspended successfully.'});
    } catch (error) {
        console.error("Error suspending/unsuspending user:", error);
    }
}

export async function isSuspended(request, response) {
    try {
        const user = await User.findOne({ email: request.params.email });
        const admin = await User.findById(request.user.id);
        if (!admin) {
            return response.status(401).json({ message: "Admin not found." });
        }
        if (!user) {
            return response.status(404).json({ message: "User not found." });
        }
        console.log("User email:", user.email);
        return response.status(200).json({ isSuspended: user.suspended});
    }
    catch (error) {
        console.error("Error checking suspension status:", error);
    }
}

export const updateReportStatus = async (req, res) => {
    console.log("Received request to update report status");
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['resolved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const updatedReport = await Report.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedReport) {
            return res.status(404).json({ message: "Report not found" });
        }
        // Send email notification
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASS,
            },
        });
        const emailContent = {
            from: process.env.EMAIL,
            to: updatedReport.userEmail,
            subject: `Your Report Status Update - SoulSpeak`,
            html: `
                <h2>Report Status Update</h2>
                <p>Your report has been marked as ${status}.</p>
                <p>Report Details:</p>
                <ul>
                    <li>Type: ${updatedReport.type}</li>
                    <li>Submitted: ${updatedReport.timestamp}</li>
                    <li>Current Status: ${status}</li>
                </ul>
                <p>Thank you for helping us maintain the quality of SoulSpeak.</p>
            `
        };
        console.log(emailContent)

        await transporter.sendMail(emailContent);
        console.log("Report status updated and email sent successfully");
        res.status(200).json(updatedReport);
    } catch (error) {
        res.status(500).json({ message: "Error updating report status", error: error.message });
    }
}
