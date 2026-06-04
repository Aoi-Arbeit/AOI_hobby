document.addEventListener('DOMContentLoaded', () => {
fetch('questions.json')
    .then(response => response.json())
    .then(data => {
        const problemsList = document.getElementById('problems-list');
        data.forEach(problem => {
            const li = document.createElement('li');
            li.textContent = `${problem.difficulty}: ${problem.question}`;
            for (const [key, value] of Object.entries(problem.options)) {
                li.textContent += `\n${key}: ${value}`;
            }
            problemsList.appendChild(li);
        });
    })
    .catch(error => console.error('Error loading problems:', error));
});