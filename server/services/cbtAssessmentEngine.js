/**
 * cbtAssessmentEngine.js
 *
 * Enterprise Computer-Based Testing (CBT) Assessment, Scoring & Analytics Engine.
 * Fully decoupled from specific database drivers (Database Isolation Pattern).
 * Implements strict zero-tolerance calculation, granular attempt logging,
 * server-validated timer engine, and topic diagnostic weak-area algorithms.
 */

// ── CONSTANTS & STATUS DEFINITIONS ──────────────────────────────
const QUESTION_STATUS = Object.freeze({
    UNVISITED: 'Unvisited',
    VISITED_UNANSWERED: 'Visited/Unanswered',
    ANSWERED: 'Answered',
    MARKED_FOR_REVIEW: 'Marked for Review',
    ANSWERED_MARKED_FOR_REVIEW: 'Answered & Marked for Review'
});

const DIAGNOSTIC_CLASSIFICATION = Object.freeze({
    CRITICAL_WEAKNESS: 'CRITICAL_WEAKNESS',
    MODERATE_WEAKNESS: 'MODERATE_WEAKNESS',
    STRENGTH: 'STRENGTH',
    AVERAGE: 'AVERAGE'
});

// ── UTILITY: SAFE NUMERIC DIVISION ──────────────────────────────
function safeDivide(numerator, denominator, fallback = 0) {
    if (!denominator || isNaN(denominator) || denominator === 0) return fallback;
    if (isNaN(numerator)) return fallback;
    const res = numerator / denominator;
    return isFinite(res) ? res : fallback;
}

function roundTo(num, decimals = 2) {
    if (isNaN(num) || !isFinite(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * factor) / factor;
}

// ── MODULE 1: ASSESSMENT SESSION & TIMER ENGINE ─────────────────

/**
 * Determine the exact standardized status of a question attempt.
 * @param {boolean} visited - Whether the candidate opened/viewed the question.
 * @param {*} userResponse - The candidate selection or value.
 * @param {boolean} markedForReview - Review checkbox flag.
 * @returns {string} One of QUESTION_STATUS values.
 */
function deriveQuestionStatus(visited, userResponse, markedForReview) {
    const hasResponse = isResponseValid(userResponse);
    if (!visited && !hasResponse && !markedForReview) {
        return QUESTION_STATUS.UNVISITED;
    }
    if (hasResponse && markedForReview) {
        return QUESTION_STATUS.ANSWERED_MARKED_FOR_REVIEW;
    }
    if (markedForReview) {
        return QUESTION_STATUS.MARKED_FOR_REVIEW;
    }
    if (hasResponse) {
        return QUESTION_STATUS.ANSWERED;
    }
    return QUESTION_STATUS.VISITED_UNANSWERED;
}

/**
 * Check if a candidate's answer is non-empty.
 */
function isResponseValid(response) {
    if (response === null || response === undefined) return false;
    if (typeof response === 'string') return response.trim().length > 0;
    if (Array.isArray(response)) return response.length > 0;
    if (typeof response === 'number') return !isNaN(response);
    return false;
}

/**
 * Server-authoritative timer calculator for re-connection & resumption.
 * Prevents client-side clock tampering by validating against server timestamps.
 * @param {Date|string|number} startTime - Session start timestamp
 * @param {number} durationMinutes - Total duration allocated in minutes
 * @param {Date} [serverNow=new Date()] - Current server clock
 * @returns {Object} Timer state payload
 */
function calculateServerTimerState(startTime, durationMinutes, serverNow = new Date()) {
    const nowMs = new Date(serverNow).getTime();
    const startMs = new Date(startTime).getTime();
    const durationSeconds = Math.max(0, Math.floor((durationMinutes || 180) * 60));
    const allocatedMs = durationSeconds * 1000;
    const endMs = startMs + allocatedMs;

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));
    const isExpired = nowMs >= endMs;

    return {
        server_now: new Date(nowMs).toISOString(),
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        total_duration_seconds: durationSeconds,
        elapsed_seconds: elapsedSeconds,
        remaining_seconds: remainingSeconds,
        is_expired: isExpired
    };
}

// ── MODULE 2: QUESTION EVALUATION ROUTINES ──────────────────────

/**
 * Evaluate whether candidate response matches the correct answer.
 * Robustly handles:
 *  - MCQ (Single Choice: Letters 'A'-'D', indices '1'-'4', or text equality)
 *  - Multi-Select / Multiple Choice (Array of correct choices)
 *  - Numerical Value (Floating-point comparison with tolerance)
 *
 * @param {*} userResponse - Candidate answer
 * @param {*} correctResponse - Master answer definition
 * @param {string} [questionType='MCQ'] - 'MCQ' | 'MULTIPLE_CHOICE' | 'NUMERICAL'
 * @param {number} [tolerance=0] - Precision tolerance for numerical questions
 * @param {Array<string>} [options=[]] - List of options for index-to-text mapping
 * @returns {boolean} True if correct, false otherwise
 */
function evaluateQuestionAnswer(userResponse, correctResponse, questionType = 'MCQ', tolerance = 0, options = []) {
    if (!isResponseValid(userResponse) || !isResponseValid(correctResponse)) {
        return false;
    }

    const qTypeUpper = (questionType || 'MCQ').toString().toUpperCase().trim();

    // 1. Numerical Comparison
    if (qTypeUpper === 'NUMERICAL' || qTypeUpper === 'NUMERIC') {
        const parsedUser = parseFloat(String(userResponse).trim());
        const parsedCorrect = parseFloat(String(correctResponse).trim());
        if (isNaN(parsedUser) || isNaN(parsedCorrect)) return false;
        const tol = Math.max(0, parseFloat(tolerance) || 0) + 1e-9;
        return Math.abs(parsedUser - parsedCorrect) <= tol;
    }

    // 2. Multi-Select / Multiple Choice (Array Comparison)
    if (qTypeUpper === 'MULTIPLE_CHOICE' || qTypeUpper === 'MULTI_SELECT' || qTypeUpper === 'MCQ_MULTI' || Array.isArray(userResponse) || Array.isArray(correctResponse)) {
        const normalizeArray = (val) => {
            if (Array.isArray(val)) {
                return val.map(x => String(x).trim().toLowerCase()).filter(Boolean).sort();
            }
            if (typeof val === 'string') {
                return val.split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean).sort();
            }
            return [String(val).trim().toLowerCase()];
        };

        const userArr = normalizeArray(userResponse);
        const correctArr = normalizeArray(correctResponse);
        if (userArr.length !== correctArr.length || userArr.length === 0) return false;
        return userArr.every((v, i) => v === correctArr[i]);
    }

    // 3. Single-Choice MCQ
    const userStr = String(userResponse).trim();
    const correctStr = String(correctResponse).trim();

    // Direct case-insensitive match
    if (userStr.toLowerCase() === correctStr.toLowerCase()) {
        return true;
    }

    // Letter to Number / Number to Letter conversion ('A' <-> '1', 'B' <-> '2', etc.)
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const userLetterIdx = letters.indexOf(userStr.toUpperCase());
    const correctLetterIdx = letters.indexOf(correctStr.toUpperCase());

    const userNum = parseInt(userStr, 10);
    const correctNum = parseInt(correctStr, 10);

    if (userLetterIdx !== -1 && correctNum === userLetterIdx + 1) return true;
    if (correctLetterIdx !== -1 && userNum === correctLetterIdx + 1) return true;

    // Option text match if options array is available
    if (Array.isArray(options) && options.length > 0) {
        // Candidate picked letter, answer stored as option text
        if (userLetterIdx !== -1 && options[userLetterIdx]) {
            if (String(options[userLetterIdx]).trim().toLowerCase() === correctStr.toLowerCase()) {
                return true;
            }
        }
        // Correct answer is letter, candidate picked option text
        if (correctLetterIdx !== -1 && options[correctLetterIdx]) {
            if (String(options[correctLetterIdx]).trim().toLowerCase() === userStr.toLowerCase()) {
                return true;
            }
        }
    }

    return false;
}

// ── MODULE 3: SCORING & COMPREHENSIVE ANALYTICS ENGINE ──────────

/**
 * Executes full scoring and diagnostic analytics for an assessment session.
 * Pure logic function: fully unit-testable and independent of DB tier.
 *
 * @param {Object} params
 * @param {Object} params.exam - The exam definition containing questions and sections
 * @param {Array<Object>} params.exam.questions - List of question items
 * @param {number} [params.exam.duration_minutes=180] - Allocated test duration
 * @param {Array<Object>} [params.exam.sections=[]] - Section definitions & marking rules
 * @param {Array<Object>} params.submittedAnswers - Candidate submissions from client
 * @param {Object} [params.blueprint=null] - Optional blueprint marking rules
 * @returns {Object} Comprehensive evaluation output conforming exactly to Modules 2 & 3
 */
function calculateAssessmentAnalytics({ exam, submittedAnswers = [], blueprint = null }) {
    if (!exam || !Array.isArray(exam.questions)) {
        throw new Error('Invalid assessment: exam.questions array is required.');
    }

    const questions = exam.questions;
    const totalQuestions = questions.length;
    const durationMinutes = exam.duration_minutes || exam.durationMinutes || 180;
    const totalTimeAllocatedSeconds = durationMinutes * 60;

    // Index submitted answers by question identifier
    const answerMap = new Map();
    if (Array.isArray(submittedAnswers)) {
        for (const ans of submittedAnswers) {
            const possibleIds = [ans.question_id, ans.questionId, ans._id, ans.id].filter(Boolean);
            for (const pid of possibleIds) {
                answerMap.set(pid.toString(), ans);
            }
        }
    }

    // Optional section limits (e.g. JEE Section B: maximum allowed to answer)
    const sectionAllowedMap = {};
    const sectionAnsweredCount = {};
    if (Array.isArray(exam.sections)) {
        for (const sec of exam.sections) {
            if (sec && sec.sectionName && typeof sec.allowedToAnswer === 'number' && sec.allowedToAnswer > 0) {
                sectionAllowedMap[sec.sectionName] = sec.allowedToAnswer;
                sectionAnsweredCount[sec.sectionName] = 0;
            }
        }
    }

    // Tracking metrics
    let totalScore = 0;
    let totalAttempted = 0;
    let totalUnattempted = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let markedForReviewCount = 0;

    let timeCorrectSum = 0;
    let timeIncorrectSum = 0;
    let timeSkippedSum = 0;
    let totalTimeConsumed = 0;

    const attempts = [];
    const topicBucketMap = new Map();

    // ── PROCESS EVERY QUESTION (MODULE 2 GRANULAR ATTEMPTS) ──────
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const primaryId = (q.questionId || q._id || q.id || `q_${i}`).toString();
        let clientAns = answerMap.get(primaryId);
        if (!clientAns && q._id) clientAns = answerMap.get(q._id.toString());
        if (!clientAns && q.questionId) clientAns = answerMap.get(q.questionId.toString());
        if (!clientAns && q.id) clientAns = answerMap.get(q.id.toString());
        clientAns = clientAns || {};

        let userRawResponse = clientAns.user_response !== undefined
            ? clientAns.user_response
            : (clientAns.selectedOption !== undefined ? clientAns.selectedOption : null);

        const visited = Boolean(clientAns.visited);
        const markedForReview = Boolean(clientAns.markedForReview || clientAns.marked_for_review);
        const timeSpentSeconds = Math.max(0, parseFloat(clientAns.time_spent_seconds !== undefined ? clientAns.time_spent_seconds : (clientAns.timeTaken || 0)) || 0);

        totalTimeConsumed += timeSpentSeconds;

        const secName = q.sectionName || 'Default Section';
        let isAttempted = isResponseValid(userRawResponse);

        // Enforce optional section constraint: if quota exceeded, ignore answer
        if (isAttempted && sectionAllowedMap[secName] !== undefined) {
            if (sectionAnsweredCount[secName] >= sectionAllowedMap[secName]) {
                userRawResponse = null;
                isAttempted = false;
            } else {
                sectionAnsweredCount[secName]++;
            }
        }

        const finalStatus = clientAns.status || deriveQuestionStatus(visited, userRawResponse, markedForReview);
        if (finalStatus === QUESTION_STATUS.MARKED_FOR_REVIEW || finalStatus === QUESTION_STATUS.ANSWERED_MARKED_FOR_REVIEW) {
            markedForReviewCount++;
        }

        // Determine Section / Blueprint Marking Scheme
        let correctMarks = typeof q.marks === 'number' ? q.marks : 4;
        let incorrectMarks = typeof q.negativeMarks === 'number' ? -Math.abs(q.negativeMarks) : -1;
        let unattemptedMarks = 0;

        if (blueprint && Array.isArray(blueprint.subjects)) {
            const bpSub = blueprint.subjects.find(s => (s.subjectName || '').toLowerCase().trim() === (q.subject || '').toLowerCase().trim());
            if (bpSub && Array.isArray(bpSub.sections)) {
                const bpSec = bpSub.sections.find(s => (s.sectionName || '').toLowerCase().trim() === (q.sectionName || '').toLowerCase().trim());
                if (bpSec && bpSec.markingRules) {
                    if (typeof bpSec.markingRules.correct === 'number') correctMarks = bpSec.markingRules.correct;
                    if (typeof bpSec.markingRules.incorrect === 'number') incorrectMarks = -Math.abs(bpSec.markingRules.incorrect);
                    if (typeof bpSec.markingRules.unattempted === 'number') unattemptedMarks = bpSec.markingRules.unattempted;
                }
            }
        } else if (Array.isArray(exam.sections)) {
            const examSec = exam.sections.find(s => s.sectionName === q.sectionName);
            if (examSec && examSec.markingRules) {
                if (typeof examSec.markingRules.correct === 'number') correctMarks = examSec.markingRules.correct;
                if (typeof examSec.markingRules.incorrect === 'number') incorrectMarks = -Math.abs(examSec.markingRules.incorrect);
                if (typeof examSec.markingRules.unattempted === 'number') unattemptedMarks = examSec.markingRules.unattempted;
            }
        }

        const isCorrect = isAttempted
            ? evaluateQuestionAnswer(userRawResponse, q.answer, q.type, q.numericalTolerance, q.options)
            : false;

        if (isAttempted) {
            totalAttempted++;
            if (isCorrect) {
                totalCorrect++;
                totalScore += correctMarks;
                timeCorrectSum += timeSpentSeconds;
            } else {
                totalIncorrect++;
                totalScore += incorrectMarks;
                timeIncorrectSum += timeSpentSeconds;
            }
        } else {
            totalUnattempted++;
            totalScore += unattemptedMarks;
            timeSkippedSum += timeSpentSeconds;
        }

        // Standardized Attempt Record conforming exactly to Module 2
        const attemptRecord = {
            question_id: primaryId,
            subject_id: (q.subject || 'General').trim(),
            topic_id: (q.chapter || q.topic || 'General').trim(),
            subtopic_id: (q.concept || q.subConcept || 'General').trim(),
            difficulty_level: (q.level || 'medium').toLowerCase().trim(),
            user_response: userRawResponse,
            correct_response: q.answer !== undefined ? q.answer : '',
            is_attempted: isAttempted,
            is_correct: isCorrect,
            time_spent_seconds: roundTo(timeSpentSeconds, 2),
            status: finalStatus,
            // Auxiliary fields for backward compatibility
            questionId: q._id || q.questionId,
            selectedOption: userRawResponse,
            markedForReview: markedForReview,
            visited: visited,
            timeTaken: roundTo(timeSpentSeconds, 2)
        };

        attempts.push(attemptRecord);

        // Aggregate for Topic & Weak-Area Diagnostic Analysis
        const topicKey = `${attemptRecord.subject_id}::${attemptRecord.topic_id}::${attemptRecord.subtopic_id}`;
        if (!topicBucketMap.has(topicKey)) {
            topicBucketMap.set(topicKey, {
                subject: attemptRecord.subject_id,
                topic: attemptRecord.topic_id,
                subtopic: attemptRecord.subtopic_id,
                total_in_topic: 0,
                attempted_in_topic: 0,
                unattempted_in_topic: 0,
                correct_in_topic: 0,
                incorrect_in_topic: 0,
                total_time_in_topic: 0
            });
        }

        const bucket = topicBucketMap.get(topicKey);
        bucket.total_in_topic++;
        bucket.total_time_in_topic += timeSpentSeconds;
        if (isAttempted) {
            bucket.attempted_in_topic++;
            if (isCorrect) bucket.correct_in_topic++;
            else bucket.incorrect_in_topic++;
        } else {
            bucket.unattempted_in_topic++;
        }
    }

    // ── HIGH-LEVEL SUMMARY CALCULATIONS (MODULE 3 PART 1) ────────
    const accuracyPercentage = roundTo(safeDivide(totalCorrect, totalAttempted) * 100, 2);
    const avgTimePerQuestion = roundTo(safeDivide(totalTimeConsumed, totalQuestions), 2);
    const avgTimeCorrect = roundTo(safeDivide(timeCorrectSum, totalCorrect), 2);
    const avgTimeIncorrect = roundTo(safeDivide(timeIncorrectSum, totalIncorrect), 2);
    const avgTimeSkipped = roundTo(safeDivide(timeSkippedSum, totalUnattempted), 2);

    const summary = {
        total_questions: totalQuestions,
        total_attempted: totalAttempted,
        total_unattempted: totalUnattempted,
        marked_for_review: markedForReviewCount,
        total_correct: totalCorrect,
        total_incorrect: totalIncorrect,
        total_score: roundTo(totalScore, 2),
        accuracy_percentage: accuracyPercentage,
        total_time_allocated_seconds: totalTimeAllocatedSeconds,
        total_time_consumed_seconds: roundTo(totalTimeConsumed, 2),
        avg_time_per_question: avgTimePerQuestion,
        avg_time_correct: avgTimeCorrect,
        avg_time_incorrect: avgTimeIncorrect,
        avg_time_skipped: avgTimeSkipped
    };

    // ── TOPIC & WEAK-AREA DIAGNOSTIC ANALYSIS (MODULE 3 PART 2) ──
    const topicDiagnostics = [];
    for (const bucket of topicBucketMap.values()) {
        const accuracyRate = roundTo(safeDivide(bucket.correct_in_topic, bucket.attempted_in_topic) * 100, 2);
        const attemptRate = roundTo(safeDivide(bucket.attempted_in_topic, bucket.total_in_topic) * 100, 2);
        const avgTimePerTopicQuestion = roundTo(safeDivide(bucket.total_time_in_topic, bucket.total_in_topic), 2);

        // Strict "Weak Area" Flagging Algorithm
        let classification = DIAGNOSTIC_CLASSIFICATION.AVERAGE;
        if (accuracyRate < 40 || (attemptRate < 50 && bucket.total_in_topic >= 3)) {
            classification = DIAGNOSTIC_CLASSIFICATION.CRITICAL_WEAKNESS;
        } else if (accuracyRate >= 40 && accuracyRate < 60) {
            classification = DIAGNOSTIC_CLASSIFICATION.MODERATE_WEAKNESS;
        } else if (accuracyRate >= 80) {
            classification = DIAGNOSTIC_CLASSIFICATION.STRENGTH;
        }

        topicDiagnostics.push({
            subject: bucket.subject,
            topic: bucket.topic,
            subtopic: bucket.subtopic,
            total_in_topic: bucket.total_in_topic,
            attempted_in_topic: bucket.attempted_in_topic,
            unattempted_in_topic: bucket.unattempted_in_topic,
            correct_in_topic: bucket.correct_in_topic,
            incorrect_in_topic: bucket.incorrect_in_topic,
            total_time_in_topic: roundTo(bucket.total_time_in_topic, 2),
            accuracy_rate: accuracyRate,
            attempt_rate: attemptRate,
            avg_time_per_topic_question: avgTimePerTopicQuestion,
            classification
        });
    }

    // Sort topic diagnostics: Critical Weakness first, then Moderate Weakness, then Lowest Accuracy
    topicDiagnostics.sort((a, b) => {
        const rank = {
            [DIAGNOSTIC_CLASSIFICATION.CRITICAL_WEAKNESS]: 0,
            [DIAGNOSTIC_CLASSIFICATION.MODERATE_WEAKNESS]: 1,
            [DIAGNOSTIC_CLASSIFICATION.AVERAGE]: 2,
            [DIAGNOSTIC_CLASSIFICATION.STRENGTH]: 3
        };
        const rankDiff = rank[a.classification] - rank[b.classification];
        if (rankDiff !== 0) return rankDiff;
        return a.accuracy_rate - b.accuracy_rate;
    });

    // ── TIME-LOSS / PANIC ANALYSIS (MODULE 3 PART 3) ────────────
    const panicThreshold = 2 * avgTimePerQuestion;
    const panicQuestions = [];

    for (const att of attempts) {
        if (!att.is_correct && att.time_spent_seconds > panicThreshold && panicThreshold > 0) {
            panicQuestions.push({
                question_id: att.question_id,
                subject_id: att.subject_id,
                topic_id: att.topic_id,
                time_spent_seconds: att.time_spent_seconds,
                threshold_seconds: roundTo(panicThreshold, 2),
                user_response: att.user_response,
                correct_response: att.correct_response
            });
        }
    }

    // Legacy weakAreas format for backward compatibility with older scorecard templates
    const weakAreasLegacy = topicDiagnostics
        .filter(t => t.classification === DIAGNOSTIC_CLASSIFICATION.CRITICAL_WEAKNESS || t.classification === DIAGNOSTIC_CLASSIFICATION.MODERATE_WEAKNESS)
        .map(t => ({
            subject: t.subject,
            chapter: t.topic,
            incorrect: t.incorrect_in_topic
        }));

    return {
        summary,
        attempts,
        topic_diagnostics: topicDiagnostics,
        panic_questions: panicQuestions,
        weak_areas_legacy: weakAreasLegacy
    };
}

module.exports = {
    QUESTION_STATUS,
    DIAGNOSTIC_CLASSIFICATION,
    safeDivide,
    roundTo,
    deriveQuestionStatus,
    isResponseValid,
    calculateServerTimerState,
    evaluateQuestionAnswer,
    calculateAssessmentAnalytics
};
