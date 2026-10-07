# plan-progress

Mod do [Claude Code](https://claude.com/claude-code), który nad promptem pokazuje etap zaplanowanej pracy i pasek postępu.

```
 ◆ plan etap 4/6 · Dodaję testy                              50% [ Lista ] [ Ukryj ]
 ██████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

 ✓ 1. Przeanalizuj kod
 ✓ 2. Zaprojektuj API
 ✓ 3. Napisz endpointy
 ▶ 4. Dodaję testy
 ○ 5. Zaktualizuj dokumentację
 ○ 6. Zrób code review
```

- bieżący etap, liczba etapów i procent ukończenia; po 100% pasek robi się zielony
- **[ Lista ]** rozwija pełną listę etapów, **[ Ukryj ]** chowa pasek (nowy plan pokaże go znowu)
- `/plan-progress` przełącza widoczność

## Skąd bierze plan

- z wbudowanych narzędzi Claude Code: `TodoWrite` albo `TaskCreate` / `TaskUpdate` / `TaskList`
- z własnego narzędzia `mcp__plan-progress__plan` (na sesje bez wbudowanych narzędzi do planowania); jest odroczone, więc dopóki model go nie użyje, w kontekście jest tylko jego nazwa

## Instalacja

```
/plugin install plan-progress --marketplace DamianoCode/claude-plan-progress
```

Potwierdź dodanie marketplace (`y`) i wybierz zakres (domyślnie user).

### Bez instalacji

```
git clone https://github.com/DamianoCode/claude-plan-progress
claude --plugin-dir ./claude-plan-progress
```

Mod działa tylko w sesji uruchomionej z tą flagą.

## Rozwój

```
claude plugin validate .
claude plugin test .
```

Mod to moduł function hooks (`hooks/register.tsx`); przy `--plugin-dir` przeładowuje się po każdej zmianie pliku.
