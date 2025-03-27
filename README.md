# AI Audio Recorder & Transcriber

## Przegląd
**AI Audio Recorder & Transcriber** to nowoczesna aplikacja full-stack, która umożliwia użytkownikowi nagrywanie lub przesyłanie plików audio (lub dokumentów PDF), automatyczną transkrypcję oraz analizę zawartości za pomocą narzędzi AI. Wygenerowany tekst jest następnie przekazywany do wbudowanego chatu opartego na ChatGPT, dzięki czemu użytkownik może prowadzić interaktywną rozmowę o zawartości nagrania lub dokumentu.

## Funkcjonalności
- **Nagrywanie/Przesyłanie audio:** Użytkownik może nagrać dźwięk bezpośrednio w przeglądarce lub przesłać gotowy plik audio.
- **Transkrypcja audio:** Plik audio jest wysyłany do backendu, gdzie przy użyciu Replicate API generowana jest transkrypcja.
- **Analiza treści:** Transkrypcja (lub zawartość PDF) jest automatycznie przekazywana do ChatGPT, który generuje listę najważniejszych wniosków.
- **Dynamiczne notatki:** Wygenerowane punkty wyświetlane są w formie edytowalnych notatek (podobnych do Dynalist) – można je modyfikować lub rozszerzać, a każde z nich może służyć jako zapytanie do ChatGPT.
- **Integracja z ChatGPT:** Cały kontekst (transkrypcja lub analiza PDF) jest przekazywany do wbudowanego chatu, umożliwiając swobodną i inteligentną interakcję.

## Technologie
- **Frontend:**
  - **React:** Tworzenie interaktywnego interfejsu użytkownika.
  - **React Media Recorder:** Nagrywanie dźwięku w przeglądarce.
  - **Axios:** Obsługa zapytań HTTP między frontendem a backendem.
  - **jsPDF:** Generowanie plików PDF na podstawie transkrypcji.
- **Backend:**
  - **Express.js:** Framework do tworzenia serwera i obsługi API.
  - **Multer:** Obsługa przesyłania plików.
  - **ffmpeg & fluent-ffmpeg:** Przetwarzanie i konwersja plików audio.
  - **pdfjs-dist:** Ekstrakcja tekstu z dokumentów PDF.
  - **Replicate API:** Wykorzystanie modeli AI do generowania transkrypcji.
  - **OpenAI API:** Integracja z ChatGPT (GPT-4.5-preview / GPT-4 Turbo) w celu analizy treści.
- **Deployment:**
  - **Vercel:** Hosting części frontendowej aplikacji.
  - **Render:** Hosting backendu.

## Przykładowe Zastosowania
- **Spotkania i konferencje:** Automatyczna transkrypcja nagrań ze spotkań, co umożliwia szybkie sporządzenie protokołu i podsumowanie najważniejszych punktów.
- **Edukacja:** Przekształcanie wykładów lub seminariów w tekst, ułatwiające późniejszą analizę i naukę.
- **Analiza dokumentów:** Przesyłanie PDF-ów w celu automatycznej analizy i wyodrębnienia kluczowych informacji.
- **Wsparcie biznesowe:** Ułatwienie dokumentacji oraz analizy spotkań i rozmów biznesowych, co pomaga w podejmowaniu decyzji.

## Jak To Działa
1. **Nagrywanie/Przesyłanie:** Użytkownik nagrywa dźwięk lub przesyła plik audio (lub dokument PDF) poprzez interfejs aplikacji.
2. **Przetwarzanie:** Plik jest wysyłany do serwera, gdzie:
   - Dla audio: Plik jest konwertowany i przesyłany do Replicate API, które generuje transkrypcję.
   - Dla PDF: Plik jest analizowany przy użyciu pdfjs-dist, a następnie podsumowywany.
3. **Analiza przez AI:** Transkrypcja lub analiza PDF jest przekazywana do OpenAI API, gdzie ChatGPT generuje listę najważniejszych wniosków.
4. **Dynamiczne Notatki:** Wygenerowane punkty są wyświetlane w formie edytowalnych notatek (Dynalist). Użytkownik może je modyfikować lub rozwijać, a każda notatka może być użyta jako zapytanie do chatu.
5. **Context-Aware Chat:** Cały wygenerowany kontekst (transkrypcja lub analiza) jest dostępny w wbudowanym czacie, co umożliwia dalszą, kontekstową interakcję z AI.


##Aplikacja jest dostępna live:

https://audio-transcriber-frontend.vercel.app/
