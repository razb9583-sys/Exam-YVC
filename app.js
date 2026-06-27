const letters = ['א', 'ב', 'ג', 'ד'];

// State
let currentView = 'dashboard';
let currentTestIdx = null;
let currentQuestionIdx = 0;
let userAnswers = [];
let questionTimes = [];
let timeRemaining = 7200; // 2 hours
let timerInterval = null;
let currentAttemptId = null; // Used for review mode

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateSidebarStats();
    switchView('dashboard');
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update charts if they exist
    if (window.progressChart) {
        // Need to redraw or update chart colors based on theme
        renderDashboard(); 
    }
}

// Navigation
function switchView(viewId) {
    // Hide all
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    
    // Show target
    document.getElementById(`view-${viewId}`).classList.add('active');
    const navLink = document.querySelector(`.nav-links a[onclick="switchView('${viewId}')"]`);
    if(navLink) navLink.classList.add('active');
    
    currentView = viewId;
    
    // View specific logic
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'history') renderHistory();
    if (viewId === 'tests') renderTestSelection();
    if (viewId === 'flashcards' && typeof loadFlashcards === 'function' && (!currentFlashcardsList || currentFlashcardsList.length === 0)) loadFlashcards();
    if (viewId === 'presentations' && typeof renderPresentationsList === 'function') renderPresentationsList();
}

// Sidebar updates
function updateSidebarStats() {
    const stats = StorageManager.getUserStats();
    document.getElementById('sb-level').innerText = stats.level;
    document.getElementById('sb-xp').innerText = `${stats.xp} XP`;
    
    const xpForNextLevel = stats.level * 100;
    const currentLevelXp = stats.xp % 100;
    const progress = (currentLevelXp / 100) * 100;
    document.getElementById('sb-xp-progress').style.width = `${progress}%`;
}

// --- Dashboard ---
function renderDashboard() {
    const stats = StorageManager.getUserStats();
    const history = StorageManager.getExamHistory();
    
    document.getElementById('kpi-exams').innerText = stats.totalExamsTaken;
    document.getElementById('kpi-questions').innerText = stats.totalQuestionsAnswered;
    
    const avgScore = history.length > 0 
        ? Math.round(history.reduce((sum, att) => sum + att.score, 0) / history.length) 
        : 0;
    document.getElementById('kpi-avg-score').innerText = avgScore;
    document.getElementById('kpi-streak').innerText = stats.dailyStreak;

    renderProgressChart(history);
}

function renderProgressChart(history) {
    const chartContainer = document.querySelector('.chart-container');
    if (!chartContainer) return;
    
    chartContainer.innerHTML = '';
    
    if (history.length === 0) {
        const msg = document.createElement('div');
        msg.id = 'empty-chart-msg';
        msg.style.textAlign = 'center';
        msg.style.padding = '3rem 1rem';
        msg.style.color = 'var(--text-muted)';
        msg.innerHTML = '<i class="fas fa-chart-bar" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i><br>בצע מבחן כדי לראות את גרף ההתקדמות שלך.';
        chartContainer.appendChild(msg);
        return;
    }
    
    // Sort history by date
    const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let chartHTML = '<div class="css-chart-wrapper" style="display:flex; align-items:flex-end; gap:20px; height:250px; padding:20px 0 10px; overflow-x:auto;">';
    
    sorted.forEach((att, i) => {
        const d = new Date(att.timestamp);
        const label = `מבחן ${att.testId + 1}<br><span style="font-size:0.8rem">${d.getDate()}/${d.getMonth()+1}</span>`;
        const score = Math.round(att.score);
        const color = score >= 60 ? 'var(--success)' : 'var(--danger)';
        const height = Math.max(score, 10); // Ensure the bar is visible even with low score
        
        chartHTML += `
            <div style="display:flex; flex-direction:column; align-items:center; min-width:60px; height:100%;">
                <div style="flex-grow:1; display:flex; align-items:flex-end; width:100%; justify-content:center;">
                    <div style="width:40px; background-color:${color}; height:${height}%; border-radius:4px 4px 0 0; display:flex; align-items:flex-start; justify-content:center; padding-top:5px; color:white; font-weight:bold; font-size:0.9rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        ${score}
                    </div>
                </div>
                <div style="margin-top:10px; text-align:center; color:var(--text-muted); font-size:0.9rem; line-height:1.2;">
                    ${label}
                </div>
            </div>
        `;
    });
    
    chartHTML += '</div>';
    chartContainer.innerHTML = chartHTML;
}

// --- Test Selection ---
function renderTestSelection() {
    const container = document.getElementById('test-selection-grid');
    container.innerHTML = '';
    
    exams.slice(0, 4).forEach((test, idx) => {
        const title = test[0]?.topic || `מבחן ${idx + 1}`;
        const card = document.createElement('div');
        card.className = 'card test-card';
        card.innerHTML = `
            <div class="test-icon"><i class="fas fa-laptop-code"></i></div>
            <h3>${title}</h3>
            <p style="color: var(--text-muted); margin: 10px 0;">${test.length} שאלות | 120 דקות</p>
            <button class="btn btn-primary" onclick="startExam(${idx})">התחל מבחן</button>
        `;
        container.appendChild(card);
    });

    // Add comprehensive exam card
    const compCard = document.createElement('div');
    compCard.className = 'card test-card';
    compCard.style.border = '2px solid var(--primary)';
    compCard.style.backgroundColor = 'var(--bg-secondary)';
    compCard.innerHTML = `
        <div class="test-icon"><i class="fas fa-star" style="color: #f59e0b;"></i></div>
        <h3>מבחן מסכם</h3>
        <p style="color: var(--text-muted); margin: 10px 0;">20 שאלות אקראיות | 120 דקות</p>
        <button class="btn btn-primary" style="background: var(--primary); font-weight: bold;" onclick="startComprehensiveExam()">התחל מבחן מסכם</button>
    `;
    container.appendChild(compCard);
}

// --- Comprehensive Exam ---
function startComprehensiveExam() {
    let comprehensiveTest = [];
    
    exams.slice(0, 4).forEach((exam) => {
        let shuffled = [...exam].sort(() => 0.5 - Math.random());
        comprehensiveTest = comprehensiveTest.concat(shuffled.slice(0, 5));
    });
    
    comprehensiveTest.sort(() => 0.5 - Math.random());
    comprehensiveTest = JSON.parse(JSON.stringify(comprehensiveTest));
    
    if (comprehensiveTest.length > 0) {
        comprehensiveTest[0].topic = "מבחן מסכם (20 שאלות)";
    }
    
    if (exams.length === 4) {
        exams.push(comprehensiveTest);
    } else {
        exams[4] = comprehensiveTest;
    }
    
    startExam(4);
}

// --- Exam Execution ---
let examStartTime = null;

function startExam(index) {
    currentTestIdx = index;
    currentQuestionIdx = 0;
    userAnswers = new Array(exams[index].length).fill(null);
    questionTimes = new Array(exams[index].length).fill(0);
    timeRemaining = 7200;
    examStartTime = new Date();
    
    document.getElementById('exam-title-text').innerText = exams[index][0]?.topic || `מבחן ${index + 1}`;
    switchView('exam');
    
    renderGrid();
    renderQuestion();
    updateProgress();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if(timeRemaining <= 0) {
        clearInterval(timerInterval);
        finishExam();
        return;
    }
    timeRemaining--;
    // Add time to current question
    questionTimes[currentQuestionIdx]++;
    
    let h = Math.floor(timeRemaining / 3600).toString().padStart(2, '0');
    let m = Math.floor((timeRemaining % 3600) / 60).toString().padStart(2, '0');
    let s = (timeRemaining % 60).toString().padStart(2, '0');
    document.getElementById('exam-timer').innerText = `${h}:${m}:${s}`;
}

function renderGrid() {
    const grid = document.getElementById('q-grid');
    grid.innerHTML = '';
    const testLength = exams[currentTestIdx].length;
    
    for(let i=0; i<testLength; i++) {
        const dot = document.createElement('div');
        dot.className = `q-dot ${userAnswers[i] !== null ? 'answered' : ''} ${i === currentQuestionIdx ? 'active' : ''}`;
        dot.innerText = i + 1;
        dot.onclick = () => { currentQuestionIdx = i; renderQuestion(); renderGrid(); };
        grid.appendChild(dot);
    }
}

function renderQuestion() {
    const test = exams[currentTestIdx];
    const qData = test[currentQuestionIdx];
    
    document.getElementById('question-text').innerText = `שאלה ${currentQuestionIdx + 1}: ${qData.q}`;
    
    // Bookmarks removed
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    qData.opts.forEach((optText, optIdx) => {
        const isSelected = userAnswers[currentQuestionIdx] === optIdx;
        
        const label = document.createElement('label');
        label.className = `option-label ${isSelected ? 'selected' : ''}`;
        label.onclick = () => selectOption(optIdx);
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'option';
        input.checked = isSelected;
        // Don't need onchange if label has onclick
        
        label.appendChild(input);
        label.appendChild(document.createTextNode(`${letters[optIdx]}. ${optText}`));
        
        optionsContainer.appendChild(label);
    });

    // Update nav buttons
    document.getElementById('btn-prev').style.visibility = currentQuestionIdx === 0 ? 'hidden' : 'visible';
    document.getElementById('btn-next').style.display = currentQuestionIdx === test.length - 1 ? 'none' : 'inline-block';
    document.getElementById('btn-finish').style.display = currentQuestionIdx === test.length - 1 ? 'inline-block' : 'none';
}

function selectOption(idx) {
    userAnswers[currentQuestionIdx] = idx;
    renderQuestion();
    renderGrid();
    updateProgress();
}

function changeQuestion(delta) {
    currentQuestionIdx += delta;
    renderQuestion();
    renderGrid();
}

function updateProgress() {
    const answeredCount = userAnswers.filter(a => a !== null).length;
    const testLength = exams[currentTestIdx].length;
    const percentage = (answeredCount / testLength) * 100;
    document.getElementById('exam-progress-bar').style.width = percentage + '%';
}

// Bookmarks removed

function finishExam() {
    if(userAnswers.includes(null)) {
        if(!confirm('יש שאלות שלא ענית עליהן. האם לסיים בכל זאת?')) return;
    }
    
    clearInterval(timerInterval);
    
    const test = exams[currentTestIdx];
    let correctCount = 0;
    const answersData = [];
    
    test.forEach((q, idx) => {
        const uAns = userAnswers[idx];
        const isCorrect = uAns === q.a;
        if(isCorrect) correctCount++;
        
        answersData.push({
            questionIndex: idx,
            selectedOption: uAns,
            isCorrect: isCorrect,
            timeSpent: questionTimes[idx] || 0
        });
    });
    
    const score = (correctCount / test.length) * 100;
    const duration = Math.floor((new Date() - examStartTime) / 1000); // in seconds
    
    const attempt = {
        testId: currentTestIdx,
        timestamp: new Date().toISOString(),
        durationSeconds: duration,
        status: 'Completed',
        score: score,
        totalQuestions: test.length,
        correctAnswers: correctCount,
        wrongAnswers: test.length - correctCount,
        answers: answersData
    };
    
    const attemptId = StorageManager.saveExamAttempt(attempt);
    updateSidebarStats();
    
    // Show results
    showReviewMode(attemptId);
}

// --- History & Review Mode ---
function renderHistory() {
    const history = StorageManager.getExamHistory();
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';
    
    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-history"></i><br>אין היסטוריית מבחנים עדיין</td></tr>`;
        return;
    }
    
    // Sort descending
    const sorted = [...history].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sorted.forEach(att => {
        const date = new Date(att.timestamp).toLocaleString('he-IL');
        const min = Math.floor(att.durationSeconds / 60);
        const testTitle = exams[att.testId]?.[0]?.topic || `מבחן ${att.testId + 1}`;
        const statusClass = att.score >= 60 ? 'status-passed' : 'status-failed';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${testTitle}</td>
            <td><strong>${att.score}</strong></td>
            <td>${min} דקות</td>
            <td><span class="status-badge ${statusClass}">${att.score >= 60 ? 'עבר' : 'נכשל'}</span></td>
            <td><button class="btn btn-outline" onclick="showReviewMode('${att.id}')">צפה בפרטים</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function showReviewMode(attemptId) {
    const att = StorageManager.getAttemptById(attemptId);
    if (!att) return;
    
    currentAttemptId = attemptId;
    switchView('review');
    
    document.getElementById('review-score').innerText = `ציון: ${att.score}`;
    document.getElementById('review-stats').innerText = `${att.correctAnswers} תשובות נכונות מתוך ${att.totalQuestions} | משך מבחן: ${Math.floor(att.durationSeconds/60)} דקות`;
    
    const reviewContainer = document.getElementById('review-container');
    reviewContainer.innerHTML = '';
    
    const test = exams[att.testId];
    
    att.answers.forEach((ansData, i) => {
        const q = test[ansData.questionIndex];
        const card = document.createElement('div');
        card.className = `card`;
        card.style.borderRight = `4px solid ${ansData.isCorrect ? 'var(--success)' : 'var(--danger)'}`;
        
        let html = `<h4>שאלה ${i + 1}: ${q.q}</h4><div style="margin-top:1rem;">`;
        
        q.opts.forEach((optText, optIdx) => {
            let itemClass = "option-label";
            if (optIdx === q.a) {
                itemClass += " correct-review";
            } else if (optIdx === ansData.selectedOption) {
                itemClass += " incorrect-review";
            }
            
            let badge = '';
            if (optIdx === q.a) badge = '<i class="fas fa-check-circle" style="color:var(--success); margin-right:10px;"></i>';
            else if (optIdx === ansData.selectedOption) badge = '<i class="fas fa-times-circle" style="color:var(--danger); margin-right:10px;"></i>';
            
            html += `<div class="${itemClass}" style="cursor:default;">
                        ${badge} ${letters[optIdx]}. ${optText}
                     </div>`;
        });
        
        html += `</div>`;
        
        if (q.explanation) {
            html += `<div class="explanation-box" style="display:block;">
                        <strong>הסבר: </strong> ${q.explanation}
                     </div>`;
        }
        
        card.innerHTML = html;
        reviewContainer.appendChild(card);
    });
}

// --- Flashcards ---
let currentFlashcardsList = [];
let currentFlashcardIndex = 0;

function loadFlashcards() {
    const topicSelect = document.getElementById('flashcard-topic-select').value;
    currentFlashcardsList = [];
    
    if (topicSelect === 'all') {
        exams.slice(0, 4).forEach(exam => {
            currentFlashcardsList = currentFlashcardsList.concat(exam);
        });
        currentFlashcardsList.sort(() => 0.5 - Math.random());
    } else {
        const idx = parseInt(topicSelect);
        currentFlashcardsList = [...exams[idx]].sort(() => 0.5 - Math.random());
    }
    
    currentFlashcardIndex = 0;
    renderCurrentFlashcard();
}

function renderCurrentFlashcard() {
    const cardElement = document.getElementById('current-flashcard');
    cardElement.classList.remove('is-flipped');
    
    if (currentFlashcardsList.length === 0) return;
    
    document.getElementById('flashcard-counter').innerText = `${currentFlashcardIndex + 1} / ${currentFlashcardsList.length}`;
    
    const q = currentFlashcardsList[currentFlashcardIndex];
    document.getElementById('fc-tag').innerText = q.topic || 'שאלה';
    document.getElementById('fc-question').innerText = q.q;
    
    const correctAnswerText = q.opts[q.a];
    document.getElementById('fc-answer').innerText = correctAnswerText;
    document.getElementById('fc-explanation').innerHTML = `<strong>הסבר:</strong> ${q.explanation || 'אין הסבר מפורט.'}`;
}

function flipFlashcard() {
    document.getElementById('current-flashcard').classList.toggle('is-flipped');
}

function nextFlashcard() {
    if (currentFlashcardIndex < currentFlashcardsList.length - 1) {
        currentFlashcardIndex++;
        renderCurrentFlashcard();
    }
}

function prevFlashcard() {
    if (currentFlashcardIndex > 0) {
        currentFlashcardIndex--;
        renderCurrentFlashcard();
    }
}

// --- Presentations ---
const presentationsData = [
    { title: "מצגת 1 - מבוא, ארכיטקטורה ו-UI", file: "pres_1.PDF" },
    { title: "מצגת 2 - תהליכים, פרגמנטים ושירותים (חלק א')", file: "pres_2.PDF" },
    { title: "מצגת 3 - תהליכים, פרגמנטים ושירותים (חלק ב')", file: "pres_3.PDF" },
    { title: "מצגת 4 - מסדי נתונים, Room ו-MVVM (חלק א')", file: "pres_4.PDF" },
    { title: "מצגת 5 - מסדי נתונים, Room ו-MVVM (חלק ב')", file: "pres_5.PDF" },
    { title: "מצגת 6 - שירותי ענן (Firebase)", file: "pres_6.PDF" },
    { title: "מצגת 7 - שירותי ענן (Firebase - מתקדם)", file: "pres_7.PDF" },
    { title: "מצגת 8 - mHealth ואתיקה רפואית", file: "pres_8.PDF" },
    { title: "מצגת 9 - סיכום ופרויקטים", file: "pres_9.PDF" },
    { title: "שאלות לדוגמא למבחן", file: "שאלות לדוגמא.PDF" }
];

function renderPresentationsList() {
    const listContainer = document.getElementById('presentations-list');
    
    // Only render if empty to preserve active state
    if (listContainer.children.length > 0) return;
    
    listContainer.innerHTML = '';
    
    presentationsData.forEach((pres, idx) => {
        const item = document.createElement('div');
        item.className = 'presentation-item';
        item.innerHTML = `
            <i class="fas fa-file-pdf" style="font-size: 1.5rem; color: var(--danger);"></i>
            <div style="flex: 1;">
                <h4 style="margin: 0; font-size: 1rem;">${pres.title}</h4>
                <div class="text-muted" style="font-size: 0.8rem; margin-top: 4px;">קובץ: ${pres.file}</div>
            </div>
            <i class="fas fa-chevron-left text-muted"></i>
        `;
        
        item.onclick = () => {
            document.querySelectorAll('.presentation-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadPresentation(pres.file);
        };
        
        listContainer.appendChild(item);
    });
}

function loadPresentation(filename) {
    document.getElementById('pdf-placeholder').style.display = 'none';
    const iframe = document.getElementById('pdf-iframe');
    iframe.style.display = 'block';
    
    iframe.src = `presentations/${encodeURIComponent(filename)}`;
}
