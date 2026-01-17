/**
 * UPSC Quiz Application - Core Logic
 * Organized into modules: State, UI, Parser, and Quiz Engine
 */

const QuizApp = {
    // 1. STATE MANAGEMENT
    state: {
        questions: [],
        currentIndex: 0,
        userAnswers: {}, // { questionIndex: 'a' }
        timer: 0,
        interval: null,
        activeSubject: null,
        activeYear: null
    },

    // 2. DOM ELEMENTS
    els: {
        dashboard: document.getElementById('dashboard'),
        quiz: document.getElementById('quiz-interface'),
        results: document.getElementById('result-screen'),
        questionText: document.getElementById('question-text'),
        options: document.getElementById('options-container'),
        palette: document.getElementById('question-palette'),
        timerDisplay: document.getElementById('timer'),
        scoreDisplay: document.getElementById('res-score'),
        analysis: document.getElementById('detailed-analysis')
    },

    // 3. INITIALIZATION
    init() {
        this.renderDashboard();
    },

    // 4. DATA PARSER
    // Extracts Question, Options, Answer, and Explanation from raw text
    parseText(text) {
        if (!text) return [];
        // Split by "Question X"
        const blocks = text.split(/Question\s*\d+/gi).filter(b => b.trim().length > 20);
        
        return blocks.map((block, index) => {
            // Extract options (a) through (d)
            const optionRegex = /\(([a-d])\)\s*([\s\S]+?)(?=\([a-d]\)|Ans|Answer|Explanation|$)/gi;
            const options = [];
            let match;
            while ((match = optionRegex.exec(block)) !== null) {
                options.push({ key: match[1].toLowerCase(), text: match[2].trim() });
            }

            // Find the question body (text before the first option)
            const firstOptIndex = block.search(/\([a-d]\)/i);
            const questionBody = firstOptIndex > -1 ? block.substring(0, firstOptIndex).trim() : block.trim();

            // Extract Answer (e.g., Ans: A)
            const ansMatch = block.match(/(?:Ans|Answer|Correct)\s*[:\-]?\s*[\(\[]?([a-d])[\)\]]?/i);
            const correctKey = ansMatch ? ansMatch[1].toLowerCase() : null;

            // Extract Explanation
            const expMatch = block.match(/(?:Explanation|Exp)\s*[:\-]\s*([\s\S]*)/i);
            const explanation = expMatch ? expMatch[1].trim() : "No explanation provided.";

            return { id: index, text: questionBody, options, correctKey, explanation };
        });
    },

    // 5. NAVIGATION & UI CONTROLS
    renderDashboard() {
        const data = window.getRawData();
        const subjects = Object.keys(data);
        const yearsSet = new Set();
        
        const subjContainer = document.getElementById('subject-selection');
        const yearContainer = document.getElementById('year-selection');
        
        subjContainer.innerHTML = '';
        yearContainer.innerHTML = '';

        subjects.forEach(sub => {
            Object.keys(data[sub]).forEach(y => yearsSet.add(y));
            const tile = this.createTile(sub, `${Object.keys(data[sub]).length} Years`, () => this.startQuiz(sub, null));
            subjContainer.appendChild(tile);
        });

        Array.from(yearsSet).sort().reverse().forEach(year => {
            const tile = this.createTile(year, "Full Paper", () => this.startQuiz(null, year));
            yearContainer.appendChild(tile);
        });
    },

    createTile(title, subtitle, onClick) {
        const div = document.createElement('div');
        div.className = 'tile';
        div.innerHTML = `<h3>${title}</h3><p>${subtitle}</p>`;
        div.onclick = onClick;
        return div;
    },

    startQuiz(subject, year) {
        const data = window.getRawData();
        let combinedText = "";

        if (subject) {
            Object.values(data[subject]).forEach(txt => combinedText += "\n" + txt);
        } else {
            Object.keys(data).forEach(sub => {
                if (data[sub][year]) combinedText += "\n" + data[sub][year];
            });
        }

        this.state.questions = this.parseText(combinedText);
        
        if (this.state.questions.length === 0) {
            alert("Could not load questions. Check your data format.");
            return;
        }

        // Reset State
        this.state.currentIndex = 0;
        this.state.userAnswers = {};
        this.state.timer = 0;

        // Switch View
        this.els.dashboard.classList.add('hidden');
        this.els.quiz.classList.remove('hidden');
        this.els.results.classList.add('hidden');

        this.startTimer();
        this.renderPalette();
        this.showQuestion(0);
    },

    showQuestion(index) {
        this.state.currentIndex = index;
        const q = this.state.questions[index];

        this.els.questionText.innerHTML = `<strong>Q${index + 1}:</strong><br>${q.text.replace(/\n/g, '<br>')}`;
        this.els.options.innerHTML = '';

        q.options.forEach(opt => {
            const div = document.createElement('div');
            div.className = `option-item ${this.state.userAnswers[index] === opt.key ? 'selected' : ''}`;
            div.innerHTML = `<strong>(${opt.key.toUpperCase()})</strong> ${opt.text}`;
            div.onclick = () => this.handleSelection(index, opt.key);
            this.els.options.appendChild(div);
        });

        this.updatePalette();
    },

    handleSelection(qIndex, key) {
        this.state.userAnswers[qIndex] = key;
        this.showQuestion(qIndex); // Refresh UI to show selected state
    },

    // 6. PALETTE & TIMER
    renderPalette() {
        this.els.palette.innerHTML = '';
        this.state.questions.forEach((_, i) => {
            const btn = document.createElement('div');
            btn.className = 'p-btn';
            btn.innerText = i + 1;
            btn.onclick = () => this.showQuestion(i);
            this.els.palette.appendChild(btn);
        });
    },

    updatePalette() {
        const btns = document.querySelectorAll('.p-btn');
        btns.forEach((btn, i) => {
            btn.classList.remove('active', 'answered');
            if (i === this.state.currentIndex) btn.classList.add('active');
            if (this.state.userAnswers[i]) btn.classList.add('answered');
        });
    },

    startTimer() {
        if (this.state.interval) clearInterval(this.state.interval);
        this.state.interval = setInterval(() => {
            this.state.timer++;
            let m = Math.floor(this.state.timer / 60);
            let s = this.state.timer % 60;
            this.els.timerDisplay.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }, 1000);
    },

    // 7. SUBMISSION & RESULTS
    submitQuiz() {
        if (!confirm("Are you sure you want to end the test and see results?")) return;

        clearInterval(this.state.interval);
        this.els.quiz.classList.add('hidden');
        this.els.results.classList.remove('hidden');

        let marks = 0;
        let html = '';

        this.state.questions.forEach((q, i) => {
            const userAns = this.state.userAnswers[i];
            const isCorrect = userAns === q.correctKey;
            
            if (userAns) {
                if (isCorrect) marks += 2;
                else marks -= 0.66;
            }

            html += `
                <div class="analysis-card ${isCorrect ? 'correct' : (userAns ? 'wrong' : 'skipped')}">
                    <p><strong>Question ${i + 1}</strong></p>
                    <p>${q.text}</p>
                    <p><strong>Your Ans:</strong> ${userAns ? userAns.toUpperCase() : 'Not Answered'}</p>
                    <p><strong>Correct Ans:</strong> ${q.correctKey ? q.correctKey.toUpperCase() : 'N/A'}</p>
                    <div class="exp-box"><strong>Explanation:</strong> ${q.explanation}</div>
                </div>
            `;
        });

        this.els.scoreDisplay.innerText = marks.toFixed(2);
        this.els.analysis.innerHTML = html;
        window.scrollTo(0, 0);
    },

    // 8. NAVIGATION BUTTONS
    next() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.showQuestion(this.state.currentIndex + 1);
        }
    },

    prev() {
        if (this.state.currentIndex > 0) {
            this.showQuestion(this.state.currentIndex - 1);
        }
    }
};

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => QuizApp.init());

// Global aliases for HTML buttons
window.prevQuestion = () => QuizApp.prev();
window.saveAndNext = () => QuizApp.next();
window.submitTest = () => QuizApp.submitQuiz();