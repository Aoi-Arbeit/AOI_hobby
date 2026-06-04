import { useState } from 'react'
import Header from '../components/Header'

interface ContentItem {
  title: string
  description: string
}

type TabType = '基礎知識' | '注文タイプ' | '指標の読み方' | '用語集'

const CONTENT: Record<TabType, ContentItem[]> = {
  '基礎知識': [
    {
      title: 'スプレッド',
      description: 'BID（売値）とASK（買値）の差です。小さいほど取引コストが低くなり、流動性が高い通貨ペアではスプレッドが狭い傾向です。',
    },
    {
      title: 'ピップス',
      description: '価格変動の最小単位を「pips」といいます。ほとんどの通貨ペアでは0.0001が1pipsですが、JPY関連は0.01が1pipsです。',
    },
    {
      title: 'ロット',
      description: 'ロットは取引数量の単位です。1ロット=10,000通貨が一般的です。0.1ロットなら1,000通貨、100ロットなら1,000,000通貨の取引になります。',
    },
    {
      title: 'レバレッジ',
      description: '証拠金を担保に、その数倍の金額で取引できるシステムです。25倍なら100万円で2,500万円分の取引が可能です。リスクが高まるため慎重な使用が必要です。',
    },
    {
      title: '証拠金',
      description: 'ポジションを保有するために必要な担保金です。必要証拠金 = 取引金額 ÷ レバレッジで計算されます。有効証拠金が必要証拠金より低いとロスカットされます。',
    },
    {
      title: 'スワップポイント',
      description: '異なる2国の金利差によって発生する利息です。高金利通貨を買っていれば毎日プラス、売っていればマイナスになります。長期保有時に重要です。',
    },
    {
      title: 'エクイティ',
      description: 'エクイティ = 残高 + 含み益/損 です。口座の実際の価値を表します。有効証拠金とも呼ばれ、これが必要証拠金以下になるとロスカットされます。',
    },
    {
      title: 'ロスカット',
      description: '含み損が大きくなり、有効証拠金が一定水準以下になると、強制的にポジションが決済されます。追加の損失を防ぐための仕組みです。',
    },
    {
      title: 'トレンド',
      description: '市場の方向性を示します。上昇トレンド（上値が切り上がり、下値も切り上がる）、下降トレンド、横ばいの3種類があります。',
    },
    {
      title: 'サポート・レジスタンス',
      description: 'サポートは価格が下がりにくいレベル（買い圧力）、レジスタンスは上がりにくいレベル（売り圧力）です。これらを意識して取引計画を立てます。',
    },
  ],
  '注文タイプ': [
    {
      title: '成行注文（Market Order）',
      description: '現在のレートで即座に約定する注文です。確実に約定しますが、スリッページが発生する可能性があります。素早いエントリーに向いています。',
    },
    {
      title: '指値注文（Limit Order）',
      description: 'あらかじめ設定したレートで約定する注文です。有利な価格でのエントリーを狙えますが、約定しない可能性もあります。スイングトレード向けです。',
    },
    {
      title: '逆指値注文（Stop Order）',
      description: 'あらかじめ設定したレートを越えたら注文が発動します。ブレイクアウト狙いや損切りに使われます。トレンド追従戦略に有効です。',
    },
    {
      title: 'OCO注文（One-Cancels-Other）',
      description: '指値注文と逆指値注文を同時に出す注文です。どちらか一方が約定すれば、もう一方は自動的にキャンセルされます。利確と損切りを同時に設定できます。',
    },
    {
      title: 'IFD注文（If-Filled Done）',
      description: '最初の注文が約定したら、自動的に決済注文が出される仕組みです。エントリーと決済を一度に指定できるため、管理が楽です。',
    },
    {
      title: 'IFO注文（If-Filled One Cancels Other）',
      description: 'IFDにOCOの機能を組み合わせたものです。最初の注文が約定したら、指値と逆指値の両方が同時に出され、どちらか一方が約定すればもう一方がキャンセルされます。',
    },
  ],
  '指標の読み方': [
    {
      title: 'NFP（雇用統計）',
      description: '米国の非農業部門雇用者数です。毎月第1金曜日に発表され、米ドルへの影響が最大です。予想値との乖離が大きいほどボラティリティが高まります。',
    },
    {
      title: 'CPI（消費者物価指数）',
      description: 'インフレ率を示す重要指標です。CPI上昇 = インフレ懸念 = 金利引き上げ圧力となり、通貨が強くなる傾向があります。',
    },
    {
      title: 'GDP（国内総生産）',
      description: '国の経済規模を示す指標です。成長率が高い国の通貨が買われやすくなります。速報値 → 改定値 → 確定値の順に発表されます。',
    },
    {
      title: '政策金利',
      description: '各国の中央銀行が決定する金利です。利上げは通貨買い、利下げは通貨売りのシグナルになります。長期的なトレンドを左右する最重要指標です。',
    },
    {
      title: 'PMI（購買担当者指数）',
      description: '製造業やサービス業の景気動向を示します。50を境に、50以上なら景気拡大、50以下なら景気後退を示唆します。',
    },
    {
      title: '失業率',
      description: '労働市場の健全性を示します。低いほど経済が好調です。NFPと同様に注視される重要指標です。',
    },
    {
      title: 'PPI（生産者物価指数）',
      description: 'インフレの先行指標です。PPIが上昇するとCPIが後追いして上昇する傾向があり、金利引き上げ圧力になります。',
    },
    {
      title: '小売売上',
      description: '消費の強さを示す指標です。上昇は景気好調の証で、その国の通貨買いにつながりやすいです。',
    },
    {
      title: '鉱工業生産',
      description: '製造業の活動水準を示します。上昇は景気強気のシグナルで、その国の通貨買い圧力になります。',
    },
    {
      title: 'BOE / FRB / ECB 政策決定',
      description: '各国の中央銀行の声明と政策決定は市場に大きなインパクトを与えます。発表時間前後のボラティリティが極めて高くなります。',
    },
  ],
  '用語集': [
    {
      title: 'BID（ビッド）',
      description: '売値のこと。売り手が提示する価格です。トレーダーが売却する際はこのレートで約定します。',
    },
    {
      title: 'ASK（アスク）',
      description: '買値のこと。売り手が要求する価格です。トレーダーが買い付ける際はこのレートで約定します。',
    },
    {
      title: 'ロング',
      description: '買いポジションを持つこと。価格が上がることで利益になります。「ロングポジション」ともいいます。',
    },
    {
      title: 'ショート',
      description: '売りポジションを持つこと。価格が下がることで利益になります。先物市場での売却を意味します。',
    },
    {
      title: 'ボラティリティ',
      description: '価格変動の激しさを示します。ボラティリティが高い = 値動きが大きい = リスク＆利益の機会が大きいです。',
    },
    {
      title: 'ドローダウン',
      description: 'ポジションの含み損、または口座の資産曲線の下落幅です。「最大ドローダウン」は最大下落幅を示します。',
    },
    {
      title: 'プロフィットファクター（PF）',
      description: '全利益 ÷ 全損失の比率です。1.5以上なら優良な戦略とされます。',
    },
    {
      title: 'エクスペクテッド・バリュー（期待値）',
      description: '1トレードあたりの平均利益 / 損失です。長期的な戦略の収益性を判断する重要指標です。',
    },
    {
      title: 'リスク・リワード・レシオ（RRR）',
      description: '利益目標 ÷ 損切り幅の比率です。1:2以上が目安とされ、大きいほど有利なトレードです。',
    },
    {
      title: 'スリッページ',
      description: '注文価格と約定価格の差です。市場が急に動くと発生しやすく、思わぬ損失につながります。',
    },
  ],
}

export default function Learn() {
  const [activeTab, setActiveTab] = useState<TabType>('基礎知識')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const tabs: TabType[] = ['基礎知識', '注文タイプ', '指標の読み方', '用語集']
  const content = CONTENT[activeTab]

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <div className="p-4 max-w-3xl mx-auto w-full">
        <h1 className="text-lg font-bold text-white mb-4">学習コンテンツ</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setExpandedItem(null)
              }}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-panel border border-border text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-2">
          {content.map((item) => {
            const itemId = `${activeTab}-${item.title}`
            const isExpanded = expandedItem === itemId

            return (
              <div key={itemId} className="bg-panel border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedItem(isExpanded ? null : itemId)}
                  className="w-full px-4 py-3 hover:bg-panel/80 transition-colors text-left flex items-center justify-between"
                >
                  <span className="font-semibold text-white text-sm">{item.title}</span>
                  <span className="text-slate-400 text-lg flex-shrink-0">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 py-3 bg-surface border-t border-border text-sm text-slate-300">
                    {item.description}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
