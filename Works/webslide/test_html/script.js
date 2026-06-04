const slides = document.querySelectorAll('.slide');
const pageDisplay = document.getElementById('page-number');
let current = 0;

// ページ番号を更新する専用の関数を作るとスッキリします
const updateDisplay = () => {
    // 全スライドからactiveを消す
    slides.forEach(s => s.classList.remove('active'));
    // 現在のスライドにactiveをつける
    slides[current].classList.add('active');
        
    // ページ番号表示（要素が存在する場合のみ）
    if (pageDisplay) {
        pageDisplay.innerText = `${current + 1} / ${slides.length}`;
    }
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
        current = (current + 1) % slides.length;
        updateDisplay();
    } else if (e.key === 'ArrowLeft') {
        current = (current - 1 + slides.length) % slides.length;
        updateDisplay();
    }
});

// クリックイベントを追加 (ファイルの最後の方に追記)
const interactiveSvg = document.getElementById('interactive-svg');
if (interactiveSvg) { // SVG要素が存在する場合のみイベントリスナーを設定
    interactiveSvg.addEventListener('click', () => {
        const shapes = interactiveSvg.querySelectorAll('.svg-shape');
        shapes.forEach(shape => {
            const currentColor = shape.getAttribute('fill');
            // 色をランダムに変更する例
            const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
            shape.setAttribute('fill', randomColor);
        });
    });
}

// 最初に一度実行して、1枚目の状態を確定させる
updateDisplay();
