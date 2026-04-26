# Hello Hermes Agent ☤

Это рабочее пространство для изучения и анализа [Hermes Agent](https://github.com/nousresearch/hermes-agent) `v0.10.0 (v2026.4.16)` `1dd6b5d5`.

> ## Произношение
> 
> Примечание: «Hermes» в этом проекте относится к греческому божеству.
> 
> ✔️ **Hermes**: `/ˈhɜːrmiːz/` — Гермес, греческий бог языка и письменности, вестник богов.
> 
> ✖️ **Hermès**: `/ɛʁ.mɛs/` — Французский люксовый бренд.

## 1 Анализ исходного кода Hermes Agent

```sh
git clone --depth 1 --branch v2026.4.16 https://github.com/nousresearch/hermes-agent
```

| Область интереса | Рекомендуемое чтение |
|------------------|----------------------|
| 🚀 Быстрый старт | Часть 1 (Поток) |
| 🗄️ Сохранение данных | Часть 2 (Данные) |
| 🔧 Разработка новых инструментов/плагинов | Часть 3 (Расширение) |
| 🐛 Отладка и устранение неполадок | Часть 4 (Отладка) |
| 🏗️ Понимание архитектуры системы | Часть 5 (Связи классов) |
| 📝 Промпт-инженерия | Часть 6 (Каталог промптов) |


## 2 Использование Hermes Agent

### Установка

```sh
# Linux / macOS / WSL2 / Android (Termux)
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
# Windows
powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1 | iex"
```

### Обновление

```sh
hermes update
hermes version
```

### Конфигурация

```sh
# Запустить мастер настройки
hermes setup

# Просмотреть/отредактировать конфигурацию
code ~/.hermes/
```

```yaml
model:
  default: kr/claude-sonnet-4.5
  provider: custom
  base_url: http://localhost:20128/v1
```

### Использование
```sh
# Начать интерактивный чат
hermes
```

## 3 Отладка с точками останова в PyCharm

### 1. Сборка

```sh
cd hermes-agent
rm -rf venv
uv venv venv --python 3.14.3
# macOS: source venv/bin/activate
# Windows: venv\Scripts\activate
uv pip install -e ".[dev,cli,pty,mcp]"
```

### 2. Директория `.run/`

Примеры конфигураций находятся в корневой директории `.run/`

| Файл `.run/` | Соответствующее расположение `.idea/` | Назначение |
|---|---|---|
| `main.run.xml` | _(остаётся в `.run/`)_ | Общая конфигурация запуска |
| `workspace.xml` | `workspace.xml` | Пример локального RunManager |
| `misc.xml` | `misc.xml` | Пример привязки интерпретатора |
| `modules.xml` | `modules.xml` | Пример регистрации модуля |
| `hello-hermes.iml` | `hello-hermes.iml` | Пример привязки SDK |

> **Частая путаница**: `.run/main.run.xml` соответствует `RunManager > configuration name="main"` в `.idea/workspace.xml`, а не одноимённому файлу, скопированному в `.idea/`. Если нужно скопировать в `.idea/`, используйте `.run/workspace.xml`.

### 3. Отладка с точками останова

1. Сделайте резервную копию `.idea/`, скопируйте одноимённые файлы из `.run/` в неё
2. Замените следующие заполнители на ваши локальные значения:

```xml
<env name="HERMES_HOME" value="<YOUR_HERMES_HOME>" />
<env name="PYTHONPATH" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="WORKING_DIRECTORY" value="<YOUR_PROJECT_DIR>\hermes-agent" />
<option name="PARAMETERS" value='chat --quiet -q "<YOUR_DEBUG_PROMPT>"' />
<option name="sdkName" value="<YOUR_PYCHARM_SDK_NAME>" />
<orderEntry type="jdk" jdkName="<YOUR_PYCHARM_SDK_NAME>" jdkType="Python SDK" />
```

<img src="images/pycharm-debug.png" alt="pycharm-debug" style="height:500px; display: block; margin-left: 0;"/>

| Элемент | Значение |
|---|---|
| Точка входа | `$PROJECT_DIR$/hermes-agent/hermes_cli/main.py` |
| Рабочая директория | `<YOUR_PROJECT_DIR>/hermes-agent` |
| Параметры по умолчанию | `chat --quiet -q "<YOUR_DEBUG_PROMPT>"` |
| Переменные окружения | `HERMES_HOME`, `PYTHONPATH`, `PYTHONIOENCODING=utf-8`, `PYTHONUNBUFFERED=1` |

`chat --quiet -q` использует путь одиночного запроса, избегая интерактивного TUI, чтобы предотвратить `NoConsoleScreenBufferError` в окне запуска PyCharm. `HERMES_HOME` явно указан для повторного использования локальной конфигурации и ключей; `PYTHONPATH` / `WORKING_DIRECTORY` зафиксированы на `hermes-agent/` для соответствия реальной среде командной строки.

Для отладки других запросов просто измените `PARAMETERS`:

```sh
chat --quiet -q "Read the current repo and explain the startup flow"
chat --quiet -q "Return only JSON: {status, summary}"
chat --quiet --toolsets web,terminal -q "Check the latest Python release and write notes to notes/python.md"
```

Для полного прохождения цепочки вызовов одиночного запроса, цепочки запуска, ветвей инструментов и путей сохранения состояния обратитесь к: [Анализ архитектуры Hermes (часть 4): Отладка · Полное прохождение связей](./Hermes%20架构解析%20(四)：调试篇%20·%20完整链路走查.md)

### 4 Отладка многораундовых сессий

При запуске полных многораундовых диалогов используйте параметр `--resume` / `-r` для возобновления предыдущих сессий и сохранения полного контекста:

```sh
# Раунд 1: Начальный запрос (возвращает session_id)
python hermes-agent/hermes_cli/main.py chat --quiet -q "Summarize the repository structure in 5 bullets"
# Вывод: session_id: 20260413_194556_5aebb2

# Раунд 2: Возобновить сессию, продолжить вопросы
python hermes-agent/hermes_cli/main.py chat --quiet --resume 20260413_194556_5aebb2 -q "Based on your summary, what are the main entry points?"

# Раунд 3: Снова возобновить ту же сессию
python hermes-agent/hermes_cli/main.py chat --quiet -r 20260413_194556_5aebb2 -q "How would I add a new tool to the system?"
```

**Управление сессиями**:

| Команда | Эффект |
|---|---|
| `-r <SESSION_ID>` / `--resume <SESSION_ID>` | Возобновить конкретную сессию |
| `-c` / `--continue` | Возобновить последнюю CLI-сессию |
| `-c "имя сессии"` | Возобновить по имени (требуется предварительное именование с помощью `hermes sessions rename`) |
| `hermes sessions list` | Просмотреть все сессии |
| `hermes sessions export output.jsonl --session-id <ID>` | Экспортировать конкретную сессию |

---

## 4 Ресурсы Hermes Agent

- **Официальный репозиторий**: <https://github.com/nousresearch/hermes-agent>
- **Официальный сайт**: <https://hermes-agent.nousresearch.com>
- **Документация по быстрому старту**: <https://hermes-agent.nousresearch.com/docs/getting-started/quickstart>

<img src="images/hello-hermes.png" alt="hello-hermes" style="height:800px; display: block; margin-left: 0;" />
