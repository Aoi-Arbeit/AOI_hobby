import React, { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, AlertCircle, Info } from 'lucide-react';

const quizData = {
  title: "Checkpoint 3: アルゴリズム応用・データ構造 総合復習",
  questions: [
    {
      id: 1,
      question: "次の擬似言語プログラムにおいて、空欄に入る条件式として最も適切なものはどれですか。\n\n// 配列Aを昇順にソートする（バブルソート）\nfor i を 1 から 要素数 - 1 まで 1 ずつ増やす:\n    for j を 1 から 要素数 - i まで 1 ずつ増やす:\n        if ( 【 空欄 】 ) then\n            swap(A[j], A[j+1])\n        endif\n    endfor\nendfor",
      options: [
        { text: "A[j] < A[j+1]", isCorrect: false, rationale: "これでは降順（大きい順）にソートされてしまいます。" },
        { text: "A[j] > A[j+1]", isCorrect: true, rationale: "昇順ソートの場合、左側の要素(A[j])が右側(A[j+1])より大きい場合に交換します。" },
        { text: "A[i] > A[j]", isCorrect: false, rationale: "バブルソートは「隣り合う要素」を比較します。iとjを比較するのは誤りです。" },
        { text: "A[j] > A[i]", isCorrect: false, rationale: "これもバブルソートのアルゴリズムとしては不適切です。" }
      ],
      hint: "バブルソートは「隣り合う2つ」を比べて、順番が逆なら入れ替えるアルゴリズムです。"
    },
    {
      id: 2,
      question: "二分探索法を用いて、1,000個の整列済みデータから目的の値を探索する場合、最大で何回の比較が必要ですか。（2の10乗 = 1024 とします）",
      options: [
        { text: "10回", isCorrect: true, rationale: "探索範囲が毎回半分になるため、log2(1000) ≒ 10回となります。" },
        { text: "500回", isCorrect: false, rationale: "これは線形探索（前から順に探す）の平均的な回数です。" },
        { text: "1000回", isCorrect: false, rationale: "これは線形探索の最悪の回数です。" },
        { text: "100回", isCorrect: false, rationale: "二分探索はもっと効率的です。" }
      ],
      hint: "1000を2で何回割ると1以下になるか、と考えてみましょう。"
    },
    {
      id: 3,
      question: "クイックソートにおいて、「基準値（ピボット）」の役割として正しい説明はどれですか。",
      options: [
        { text: "配列を常に正確に半分に分割するための位置を決める。", isCorrect: false, rationale: "半分に分けるのはマージソートの特徴です。クイックソートは基準値との大小で分けます。" },
        { text: "値を比較する際の境界とし、それより「小さいグループ」と「大きいグループ」に分ける。", isCorrect: true, rationale: "ピボットを基準にしてデータを2つのグループに分けるのがクイックソートの核心です。" },
        { text: "配列内の最小値を探し出すための初期値とする。", isCorrect: false, rationale: "それは選択ソートの考え方に近いです。" },
        { text: "データを挿入するための空きスペースを決める。", isCorrect: false, rationale: "それは挿入ソートの考え方です。" }
      ],
      hint: "クイックソートの「分割」の仕組みを思い出してください。"
    },
    {
      id: 4,
      question: "空のスタックに対して次の操作を順に行ったとき、スタックに残っているデータの数はいくつですか。\n\nPush(A), Push(B), Pop(), Push(C), Push(D), Pop(), Pop(), Push(E)",
      options: [
        { text: "1個", isCorrect: false, rationale: "計算ミスがあるようです。一つずつ追ってみましょう。" },
        { text: "2個", isCorrect: true, rationale: "A(1)→AB(2)→A(1)→AC(2)→ACD(3)→AC(2)→A(1)→AE(2) となり、2個残ります。" },
        { text: "3個", isCorrect: false, rationale: "Popされた回数を数え間違えている可能性があります。" },
        { text: "0個", isCorrect: false, rationale: "最後にPush(E)をしているので、必ず1つ以上は残ります。" }
      ],
      hint: "Pushで+1、Popで-1と数えてみましょう。"
    },
    {
      id: 5,
      question: "単方向リストにおいて、あるノードPの直後に新しいノードQを挿入する正しい手順はどれですか。（nextは次のノードへのポインタとします）",
      options: [
        { text: "1: P.next = Q, 2: Q.next = P.next", isCorrect: false, rationale: "1の手順でPの次がQに変わってしまうため、元々Pの次だったノードが分からなくなります。" },
        { text: "1: Q.next = P.next, 2: P.next = Q", isCorrect: true, rationale: "まず新しいノードQの先を既存の次ノードに繋ぎ、その後にPの次をQに繋ぎ変えるのが正解です。" },
        { text: "1: Q.next = P, 2: P.next = Q", isCorrect: false, rationale: "これではPとQが互いに指し合うループになってしまいます。" },
        { text: "1: P.next = Q.next, 2: Q.next = P", isCorrect: false, rationale: "ポインタの向きが逆です。" }
      ],
      hint: "「迷子」を出さないために、先に新しいノードの行き先を確保する必要があります。"
    }
  ]
};

export default function App() {
  const [currentStep, setCurrentStep] = useState('start'); // start, quiz, result
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleStart = () => {
    setCurrentStep('quiz');
    setCurrentIdx(0);
    setScore(0);
    setIsAnswered(false);
    setSelectedIdx(null);
  };

  const handleAnswer = (idx) => {
    if (isAnswered) return;
    setSelectedIdx(idx);
    setIsAnswered(true);
    if (quizData.questions[currentIdx].options[idx].isCorrect) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIdx < quizData.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setIsAnswered(false);
      setSelectedIdx(null);
      setShowHint(false);
    } else {
      setCurrentStep('result');
    }
  };

  if (currentStep === 'start') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-indigo-600 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-4">{quizData.title}</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Day 11〜15のアルゴリズム応用・データ構造の習得度を確認します。
            ソート、探索、スタック、キュー、リストの全5問です。
          </p>
          <button
            onClick={handleStart}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            クイズを開始する
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 'result') {
    const passScore = 4;
    const isPassed = score >= passScore;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-2">結果発表</h2>
          <div className="text-6xl font-black text-indigo-600 my-6">
            {score} <span className="text-2xl text-slate-400">/ {quizData.questions.length}</span>
          </div>
          
          <div className={`p-4 rounded-xl mb-8 ${isPassed ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
            <p className="font-bold text-lg mb-1">{isPassed ? '素晴らしい成果です！' : 'あと一歩です！'}</p>
            <p className="text-sm">
              {isPassed 
                ? '応用アルゴリズムの基礎がしっかり身についています。このままPhase 2の後半に進みましょう。' 
                : '間違えた箇所のトレースをもう一度見直してみましょう。基礎を固めることが⭐️4への近道です。'}
            </p>
          </div>

          <button
            onClick={handleStart}
            className="flex items-center justify-center w-full bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-200 transition-colors mb-4"
          >
            <RotateCcw className="w-5 h-5 mr-2" /> もう一度挑戦する
          </button>
        </div>
      </div>
    );
  }

  const currentQ = quizData.questions[currentIdx];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-bold text-indigo-600 uppercase tracking-wider">Question {currentIdx + 1} of {quizData.questions.length}</span>
            <span className="text-xs text-slate-400">Score: {score}</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-300" 
              style={{ width: `${((currentIdx + 1) / quizData.questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 mb-6">
          <div className="whitespace-pre-wrap text-lg font-medium text-slate-800 mb-8 leading-relaxed">
            {currentQ.question}
          </div>

          <div className="space-y-3">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedIdx === idx;
              const showCorrect = isAnswered && opt.isCorrect;
              const showWrong = isAnswered && isSelected && !opt.isCorrect;

              let cardStyles = "relative w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ";
              if (!isAnswered) {
                cardStyles += "border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 text-slate-700";
              } else if (showCorrect) {
                cardStyles += "border-green-500 bg-green-50 text-green-700";
              } else if (showWrong) {
                cardStyles += "border-red-500 bg-red-50 text-red-700";
              } else {
                cardStyles += "border-slate-50 text-slate-400 opacity-60";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={isAnswered}
                  className={cardStyles}
                >
                  <span className="flex-1 pr-4">{opt.text}</span>
                  {showCorrect && <CheckCircle2 className="w-6 h-6 flex-shrink-0" />}
                  {showWrong && <XCircle className="w-6 h-6 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className={`mt-6 p-4 rounded-xl flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${currentQ.options[selectedIdx].isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">{currentQ.options[selectedIdx].isCorrect ? '正解！' : '不正解'}</p>
                <p className="text-sm leading-relaxed">{currentQ.options[selectedIdx].rationale}</p>
              </div>
            </div>
          )}

          {!isAnswered && (
            <div className="mt-6">
              <button 
                onClick={() => setShowHint(!showHint)}
                className="text-indigo-600 text-sm font-medium hover:underline flex items-center"
              >
                <AlertCircle className="w-4 h-4 mr-1" /> ヒントを表示
              </button>
              {showHint && (
                <div className="mt-2 p-3 bg-indigo-50 text-indigo-700 text-sm rounded-lg border border-indigo-100 italic">
                  {currentQ.hint}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex justify-end">
          {isAnswered && (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-slate-800 text-white font-bold py-3 px-8 rounded-xl hover:bg-slate-900 transition-all shadow-lg"
            >
              {currentIdx === quizData.questions.length - 1 ? '結果を見る' : '次の問題へ'} <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}