# learnharness-git (Arch Linux)

Пакет собирает **текущий checkout** этого репозитория, а не скачивает релиз:
запускать `makepkg` нужно из `packaging/arch/`, исходники берутся из рабочего
дерева двумя уровнями выше. Поэтому в пакет попадают ваши ветки и
незакоммиченные правки — именно так проверяется локальная разработка.

## Требования

- `nodejs` и `npm` (в Arch это отдельные пакеты; версия node — как в CI, 26).
- Сеть: `npm ci` тянет зависимости из реестра, electron-builder — Electron
  (~120 МБ; качается один раз в `~/.cache/electron`).
- Около 2 ГБ свободного места: `node_modules`, `.next`, `dist/linux-unpacked`.

## Сборка и установка

```bash
cd packaging/arch
makepkg -f          # сборка пакета, без установки
sudo pacman -U learnharness-git-*.pkg.tar.zst
```

Или одной командой, с установкой зависимостей и пакета:

```bash
cd packaging/arch
makepkg -si
```

Версия пакета складывается из `package.json` и git: `0.3.8.r12.gff1b581` —
так видно, какой коммит собран.

## Что делает пакет

- Собирает приложение тем же путём, что релизный CI: `next build`
  (standalone output) → `scripts/build-server.mjs` → `electron-builder
  --linux dir` (npm-скрипт `build:linux`).
- Ставит результат в `/opt/LearnHarness`, симлинк `/usr/bin/learnharness`,
  `.desktop` и иконку — в `/usr/share`.
- Ставит `chrome-sandbox` с правами 0755: в Arch непривилегированные user
  namespaces включены, setuid-помощник не нужен.
- Кладёт `resources/package-managed-updates`: оболочка видит маркер и не
  запускает `electron-updater`. Обновление — пересборкой пакета
  (`makepkg -f`), а не самообновлением из GUI (оно пошло бы мимо pacman и
  запросило root).

Без маркера (сборка `electron-builder` без упаковки) приложение ведёт себя
как upstream: автообновление включено.

## Обновление после изменений в коде

```bash
cd packaging/arch
makepkg -f
sudo pacman -U learnharness-git-*.pkg.tar.zst
```

`pkgver()` пересчитывается автоматически; `pkgrel` трогать не нужно.

## Удаление

```bash
sudo pacman -Rns learnharness-git
# пользовательские данные остаются:
#   ~/.config/LearnHarness  (чаты, граф, ключи провайдеров — auth.json 0600)
```

## Отношение к learnharness-bin

`learnharness-git` и `learnharness-bin` конфликтуют (оба предоставляют
`learnharness`); ставить можно только один. `-bin` перепаковывает релизный
`.deb` и ничего не собирает, `-git` собирает из исходников.
