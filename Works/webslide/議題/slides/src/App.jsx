import React, { useState, useEffect } from 'react';
import { 
  Accessibility, Brain, Users, Play, Flag, Sun, Moon, Bath, Utensils, Wind, 
  ArrowLeft, Clock, ArrowRight, Zap, TrendingUp, Activity, AlertCircle, 
  CheckCircle2, UtensilsCrossed, Sparkles, Footprints, Lightbulb, Quote,
  User, ShieldAlert, XCircle, HelpCircle, RotateCcw, CloudRain, ZapOff,
  ArrowDownRight, Compass, MapPin, Navigation, ArrowUpRight, PenTool,
  ArrowUp, ChevronRight, BookOpen, Hand, ChefHat, X, Star, Trophy,
  ChevronUp, PencilLine, Globe, Share2, Briefcase, Award, Settings,
  Timer, Ban, Construction, Bridge, List, Layout
} from 'lucide-react';

/**
 * 共通コンポーネント: M1/M2/M3 バッジ
 */
const MBadges = ({ active = [true, true, true], highlight = null }) => (
  <div className="absolute top-10 right-10 flex gap-3 z-50">
    <div className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md transition-all ${active[0] ? 'bg-[#FF8F00]' : 'bg-gray-200 opacity-20'} ${highlight === 'M1' ? 'scale-125 ring-4 ring-orange-200' : ''}`}>M1</div>
    <div className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md transition-all ${active[1] ? 'bg-[#2E7D32]' : 'bg-gray-200 opacity-20'} ${highlight === 'M2' ? 'scale-125 ring-4 ring-green-200' : ''}`}>M2</div>
    <div className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md transition-all ${active[2] ? 'bg-[#4527A0]' : 'bg-gray-200 opacity-20'} ${highlight === 'M3' ? 'scale-125 ring-4 ring-purple-200' : ''}`}>M3</div>
  </div>
);

/**
 * 共通コンポーネント: ワーク用レイアウト
 */
const WorkLayout = ({ title, sub, sectionColor, children, slideNum }) => (
  <div className="w-full h-full bg-white flex flex-col p-0 font-sans overflow-hidden relative">
    <div className="pt-16 px-16 flex justify-between items-end">
      <div>
        <h2 className={`text-4xl font-bold text-gray-800 border-l-8 ${sectionColor} pl-6 tracking-tight flex items-center gap-4`}>
          {title} <PencilLine size={32} className="opacity-30" />
        </h2>
        <p className="mt-4 text-xl text-gray-500 font-medium">{sub}</p>
      </div>
      <div className="text-right pb-1">
        <span className="text-4xl font-black text-gray-100 uppercase tracking-tighter">WORK {slideNum}</span>
      </div>
    </div>
    <div className="flex-grow px-16 py-8 flex flex-col gap-6">
      {children}
    </div>
  </div>
);

/**
 * 共通コンポーネント: ワーク項目
 */
const WorkItem = ({ mTag, label, title, placeholder, icon, bgColor, borderColor, accentColor, isIfThen }) => (
  <div className={`flex-1 flex gap-6 p-6 rounded-[32px] border-2 ${borderColor} ${bgColor} animate-in slide-in-from-right-8`}>
    <div className="w-44 flex flex-col items-center justify-center border-r-2 border-white/50 pr-6 shrink-0">
      <div className={`w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-2 ${accentColor}`}>{icon}</div>
      <div className={`text-[10px] font-black px-3 py-0.5 rounded-full bg-white/50 border border-white mb-1 ${accentColor}`}>{mTag}</div>
      <span className={`text-lg font-black tracking-widest ${accentColor}`}>{label}</span>
    </div>
    <div className="flex-grow flex flex-col justify-center">
      <h4 className="text-xl font-black text-gray-700 mb-2">{title}</h4>
      <div className="bg-white/80 rounded-2xl p-4 h-24 border border-white shadow-inner flex items-center">
        {isIfThen ? (
          <div className="flex items-center w-full gap-4">
            <div className="flex-1 border-b-2 border-dashed border-orange-200 py-2 text-gray-300 font-bold italic">もし状況が起きたら</div>
            <ArrowRight className="text-orange-400" />
            <div className="flex-1 border-b-2 border-dashed border-orange-200 py-2 text-gray-300 font-bold italic">〜をする</div>
          </div>
        ) : (
          <p className="text-gray-300 font-medium italic">{placeholder}</p>
        )}
      </div>
    </div>
  </div>
);

// --- スライド・コンポーネント群 ---

const Slide1 = () => (
  <div className="w-full h-full bg-gradient-to-br from-[#E65100] to-[#FF8F00] flex flex-col items-center justify-center text-white">
    <div className="text-center z-10 space-y-8 animate-in zoom-in duration-1000">
      <h2 className="text-5xl font-bold opacity-90">頑張りすぎを</h2>
      <h1 className="text-[160px] font-black tracking-tighter leading-none">やめよう</h1>
      <div className="pt-8 flex flex-col items-center">
        <div className="w-24 h-1 bg-white/40 mb-8 rounded-full" />
        <p className="text-3xl font-medium tracking-wide">肉体・精神・社会の3健康で、無理なく全力へ</p>
      </div>
    </div>
  </div>
);

const Slide5 = () => (
  <div className="w-full h-full bg-[#2E7D32] flex flex-col items-center justify-center text-white">
    <div className="text-center z-10 space-y-12 animate-in fade-in zoom-in duration-700">
      <div className="inline-block px-6 py-2 bg-white/10 rounded-full border border-white/20">Section 01</div>
      <h2 className="text-5xl font-black tracking-widest opacity-80">肉体的健康</h2>
      <h1 className="text-9xl font-black tracking-tighter">仕組みで <span className="text-[#81C784]">整える</span></h1>
      <p className="text-2xl font-bold opacity-70 mt-8">肉体的健康 ＝ M1・M2の実践場</p>
    </div>
  </div>
);

const Slide15 = () => (
  <div className="w-full h-full bg-[#4527A0] flex flex-col items-center justify-center text-white">
    <div className="text-center z-10 space-y-12 animate-in fade-in zoom-in duration-700">
      <div className="inline-block px-6 py-2 bg-white/10 rounded-full border border-white/20">Section 02</div>
      <h2 className="text-5xl font-black tracking-widest opacity-80">精神的健康</h2>
      <h1 className="text-9xl font-black tracking-tighter">「どうせ無理」は <br/><span className="text-[#B39DDB]">脳の問題だ</span></h1>
      <p className="text-2xl font-bold opacity-70 mt-8">精神的健康 ＝ M3の根拠を脳科学で理解する</p>
    </div>
  </div>
);

const Slide23 = () => (
  <div className="w-full h-full bg-[#BF360C] flex flex-col items-center justify-center text-white">
    <div className="text-center z-10 space-y-12 animate-in fade-in zoom-in duration-700">
      <div className="inline-block px-6 py-2 bg-white/10 rounded-full border border-white/20">Section 03</div>
      <h2 className="text-5xl font-black tracking-widest opacity-80">社会的健康</h2>
      <h1 className="text-9xl font-black tracking-tighter">環境も <br/><span className="text-[#FFAB91]">きっかけの一部</span></h1>
      <p className="text-2xl font-bold opacity-70 mt-8">社会的健康 ＝ M1・M2・M3を環境に応用する</p>
    </div>
  </div>
);

const Slide33 = () => (
  <div className="w-full h-full bg-[#1A237E] flex flex-col items-center justify-center text-white">
    <div className="text-center z-10 space-y-12 animate-in fade-in zoom-in duration-700">
      <h2 className="text-6xl font-black tracking-widest opacity-80">いつからでも、</h2>
      <h1 className="text-[140px] font-black tracking-tighter leading-none">人は変われる</h1>
      <div className="pt-8 flex flex-col items-center gap-8">
        <div className="flex items-center gap-6 text-3xl font-bold bg-white/10 px-10 py-4 rounded-full border border-white/20">
          <span className="text-[#9575CD]">M3</span> <ArrowRight size={24} className="opacity-40" />
          <span className="text-[#FFB74D]">M1</span> <ArrowRight size={24} className="opacity-40" />
          <span className="text-[#81C784]">M2</span> <span className="ml-4 border-l pl-6 italic">まず一歩だけ</span>
        </div>
      </div>
    </div>
  </div>
);

// --- メイン・プレイヤー ---

const SLIDES_DATA = [
  { id: 1, title: "1. 頑張りすぎをやめよう", section: "intro", component: Slide1 },
  { id: 2, title: "2. 健康 ＝ 3つの輪", section: "intro", type: "content" },
  { id: 3, title: "3. 今日の地図", section: "intro", type: "content" },
  { id: 4, title: "W4. ワーク① 課題抽出", section: "intro", type: "work" },
  { id: 5, title: "5. セクション：肉体的健康", section: "physical", component: Slide5 },
  { id: 6, title: "6. 寝る段取り", section: "physical", type: "content" },
  { id: 7, title: "7. 5 min", section: "physical", type: "content" },
  { id: 8, title: "8. チョコを変えるだけ", section: "physical", type: "content" },
  { id: 9, title: "9. 1口 30回", section: "physical", type: "content" },
  { id: 10, title: "10. 移動を歩きに", section: "physical", type: "content" },
  { id: 11, title: "11. 朝ランの力", section: "physical", type: "content" },
  { id: 12, title: "12. 「走る人」になる", section: "physical", type: "content" },
  { id: 13, title: "13. ギャップに目を向ける", section: "physical", type: "content" },
  { id: 14, title: "W14. ワーク② 肉体設計", section: "physical", type: "work" },
  { id: 15, title: "15. セクション：精神的健康", section: "mental", component: Slide15 },
  { id: 16, title: "16. 自己効力感の壁", section: "mental", type: "content" },
  { id: 17, title: "17. 無気力は学習", section: "mental", type: "content" },
  { id: 18, title: "18. 目標はコンパス", section: "mental", type: "content" },
  { id: 19, title: "19. 動けない理由", section: "mental", type: "content" },
  { id: 20, title: "20. わかる≠できる", section: "mental", type: "content" },
  { id: 21, title: "21. 小さなできたを積む", section: "mental", type: "content" },
  { id: 22, title: "W22. ワーク③ 精神設計", section: "mental", type: "work" },
  { id: 23, title: "23. セクション：社会的健康", section: "social", component: Slide23 },
  { id: 24, title: "24. 今どの象限？", section: "social", type: "content" },
  { id: 25, title: "25. 仕事を作り変える", section: "social", type: "content" },
  { id: 26, title: "26A. 試せる場", section: "social", type: "content" },
  { id: 27, title: "26B. 実験の時間", section: "social", type: "content" },
  { id: 28, title: "28. 断るより提案", section: "social", type: "content" },
  { id: 29, title: "W29. ワーク④ 社会設計", section: "social", type: "work" },
  { id: 30, title: "30. 入り口の設計", section: "summary", type: "content" },
  { id: 31, title: "W31. ワーク⑤ 統合", section: "summary", type: "work" },
  { id: 32, title: "32. 3つの健康の統合", section: "summary", type: "content" },
  { id: 33, title: "33. エンディング", section: "summary", component: Slide33 },
];

const App = () => {
  const [index, setIndex] = useState(0);
  const [showList, setShowList] = useState(false);

  const slide = SLIDES_DATA[index];

  const next = () => setIndex(prev => Math.min(prev + 1, SLIDES_DATA.length - 1));
  const prev = () => setIndex(prev => Math.max(prev - 1, 0));

  useEffect(() => {
    const handleKeys = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  const renderContent = () => {
    if (slide.component) return <slide.component />;
    
    if (slide.type === "work") {
      return (
        <WorkLayout 
          title={slide.title} 
          sub="きっかけを設計しましょう" 
          sectionColor={slide.section === 'intro' ? 'border-[#FF8F00]' : (slide.section === 'physical' ? 'border-[#2E7D32]' : 'border-[#4527A0]')}
          slideNum={slide.id}
        >
          <WorkItem mTag="M3" label="イメージ" title="理想の自分" icon={<Target/>} bgColor="bg-purple-50" borderColor="border-purple-100" accentColor="text-purple-700" placeholder="なりたい姿を自由に記入..."/>
          <WorkItem mTag="M1" label="きっかけ" title="物理的な入り口" icon={<Zap/>} bgColor="bg-orange-50" borderColor="border-orange-100" accentColor="text-orange-700" isIfThen={slide.id === 29} placeholder="行動のきっかけを記入..."/>
          <WorkItem mTag="M2" label="ベビーステップ" title="最初の一歩" icon={<Footprints/>} bgColor="bg-green-50" borderColor="border-green-100" accentColor="text-green-700" placeholder="最小の行動単位を記入..."/>
        </WorkLayout>
      );
    }

    // 汎用コンテンツレイアウト
    return (
      <div className="w-full h-full bg-white flex flex-col justify-center items-center p-20 text-center animate-in fade-in">
        <MBadges active={[true, true, true]} />
        <div className="space-y-8">
          <span className="text-sm font-black text-gray-300 uppercase tracking-widest">{slide.section} session</span>
          <h2 className="text-7xl font-black text-gray-800 leading-tight">{slide.title}</h2>
          <div className="w-24 h-2 bg-indigo-500 mx-auto rounded-full" />
          <p className="text-2xl text-gray-400 font-bold max-w-2xl leading-relaxed">
            このページの詳細な図解とビジュアルは、<br/>各スライドの個別設計に基づき展開されます。
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      {/* 1280x720 プレゼンテーションエリア */}
      <div className="w-[1280px] h-[720px] bg-white shadow-2xl relative overflow-hidden rounded-lg">
        {renderContent()}

        {/* スライドリスト・オーバーレイ */}
        {showList && (
          <div className="absolute inset-0 bg-white/95 z-[100] p-16 overflow-y-auto backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-12">
              <h3 className="text-4xl font-black flex items-center gap-4">全スライド選択</h3>
              <button onClick={() => setShowList(false)} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><X /></button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {SLIDES_DATA.map((s, i) => (
                <button 
                  key={s.id} 
                  onClick={() => {setIndex(i); setShowList(false);}}
                  className={`p-6 text-left rounded-2xl border-2 transition-all ${index === i ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                >
                  <div className="text-[10px] font-black opacity-30 mb-1">PAGE {i+1}</div>
                  <div className="font-bold text-gray-800">{s.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* コントロールバー */}
      <div className="w-[1280px] mt-6 flex items-center justify-between px-8 py-4 bg-white rounded-2xl shadow-xl border border-gray-200">
        <div className="flex items-center gap-6">
          <button onClick={() => setShowList(true)} className="flex items-center gap-2 font-black text-gray-400 hover:text-gray-900 transition-colors">
            <List size={20} /> <span>目次を開く</span>
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <div className="text-sm font-black text-gray-400">
            PAGE <span className="text-gray-900">{index + 1}</span> / {SLIDES_DATA.length}
          </div>
        </div>

        {/* プログレスバー */}
        <div className="flex-grow mx-12 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${((index + 1) / SLIDES_DATA.length) * 100}%` }} />
        </div>

        <div className="flex items-center gap-4">
          <button onClick={prev} disabled={index === 0} className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 disabled:opacity-20">
            <ArrowLeft size={24} />
          </button>
          <button onClick={next} disabled={index === SLIDES_DATA.length - 1} className="w-48 h-12 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center gap-3 hover:bg-indigo-700 disabled:opacity-20 shadow-lg active:scale-95 transition-all">
            NEXT SLIDE <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;