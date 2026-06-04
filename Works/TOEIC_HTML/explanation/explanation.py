import os
from flask import Flask, render_template, request, jsonify
from google import genai  # 最新のインポート方式
from dotenv import load_dotenv

# ファイルの場所を明示的に指定して読み込む
load_dotenv()

api_key = "AIzaSyAZVZSgdljp8Cy59AG2sXygSVn5qatwUco"
client = genai.Client(api_key=api_key)

app = Flask(__name__, template_folder='.', static_folder='.')

@app.route('/')
def index():
    return render_template('explanation.html')

@app.route('/api/explain', methods=['POST'])
def explain():
    # 安全にデータを受け取る
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    question = data.get('question', '')
    user_code = data.get('code', '')
    error = data.get('error', '')
    
    # プロンプトの組み立て
    prompt = f"""
    あなたはTOEIC満点講師です。以下の問題の解説をMarkdown形式で作成してください。
    
    【問題】: {question}
    【学習者のPythonメモ】: {user_code}
    【実行エラー（あれば）】: {error}
    
    構成：
    1. **正解と和訳**
    2. **文法構造の解説**（S/V/O/Cなどの構造を詳しく）
    3. **重要単語リスト**（品詞と意味）
    """
    
    try:
        # 最新の生成メソッド（モデル名は最新の2.0 Flashを推奨）
        response = client.models.generate_content(
            model="gemini-2.0-flash", 
            contents=prompt
        )
        
        # 結果を返す
        return jsonify({"explanation": response.text})
    
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"explanation": "申し訳ありません。解説の生成中にエラーが発生しました。"}), 500

if __name__ == '__main__':
    # サーバーを起動
    app.run(debug=True, port=5000)