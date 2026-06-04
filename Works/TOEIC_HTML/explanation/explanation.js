let pyodideInstance = null;

// ページ読み込み時にPyodideを準備しておく
async function initPyodide() {
    if (!pyodideInstance) {
        pyodideInstance = await loadPyodide();
    }
}
initPyodide();

async function runAndExplain() {
    const question = document.getElementById('question').value;
    const code = document.getElementById('code').value;
    const inputSection = document.getElementById('input-section');
    const resultSection = document.getElementById('result-section');
    const loading = document.getElementById('loading');
    const display = document.getElementById('explanation-display');

    if (!question) return alert("問題を入力してください");

    loading.classList.remove('hidden');

    let errorMsg = "";
    try {
        // インスタンスを使い回す
        await initPyodide();
        await pyodideInstance.runPythonAsync(code);
    } catch (err) {
        errorMsg = err.message;
    }

    try {
        // Flaskサーバーの絶対パスを指定（127.0.0.1:5000で動いている場合）
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: question, 
                code: code, 
                error: errorMsg 
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        display.innerHTML = marked.parse(data.explanation);
        inputSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
    } catch (e) {
        console.error(e);
        alert("解説の取得に失敗しました。Flaskサーバーが起動しているか確認してください。");
    } finally {
        loading.classList.add('hidden');
    }
}

document.getElementById('run-btn').addEventListener('click', runAndExplain);