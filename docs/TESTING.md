# Verifica in Adobe InDesign

## Stato

Target: **InDesign 2026, versione 21.6**, verificato nelle note Adobe il 22 ottobre 2026. **InDesign non è installato nell'ambiente usato per questo aggiornamento.** La matrice seguente è un protocollo da eseguire nell'host; **non è un elenco di prove native già superate**. I test automatici locali controllano il calcolo e il comportamento simulato, non la composizione Adobe. La compatibilità operativa resta da confermare con queste prove.

Per ogni esecuzione annotare versione completa di InDesign, sistema operativo, lingua dell'interfaccia, font/compositore e risultato. Salvare screenshot prima/dopo per le prove tipografiche.

## Controlli automatici locali

Con Node.js 22 o successivo eseguire `npm test` per geometria, interfaccia simulata, transazioni e recupero da errori del DOM simulato. `npm run build` genera `dist/flattersatz.jsx`; `npm run check` esegue i test e verifica che il file distribuibile corrisponda ai sorgenti. `git diff --check` controlla gli errori di spaziatura. Questi comandi non avviano InDesign.

Esito locale del 22 ottobre 2026: **45 test superati su Node.js 22 e 24**. Verificata inoltre la sintassi ES3 dei sorgenti ExtendScript e dello smoke test con Acorn 8.15.0, escludendo le direttive Adobe dal parser. Questo controllo sintattico non esegue le API Adobe. Il workflow GitHub ripete i test e controlla il bundle su Node 22 e 24, ma non avvia InDesign.

## Smoke test nativo

Eseguire [tests/indesign-smoke.jsx](../tests/indesign-smoke.jsx) da InDesign conservando la struttura relativa della repository, perché carica i moduli con `#include`. Crea un documento temporaneo, genera testo giustificato e verifica applicazione, restringimento reale delle righe, conservazione del testo, ripristino delle preferenze, nuova applicazione, rimozione, annullamento e ripristino. Alla fine chiude il documento temporaneo senza salvarlo e comunica `PASS` oppure `FAILED` con la versione di InDesign.

Questo controllo iniziale non sostituisce la matrice: non verifica l'intera interfaccia ScriptUI, ogni configurazione tipografica o l'esportazione PDF. Un esito `FAILED` deve essere risolto prima di dichiarare pronta la distribuzione per quella versione.

## Preparazione

1. Aprire una copia di `indesign/flattersatz/flattersatz.idml` e salvarla con un nuovo nome. Controllare i font mancanti.
2. Selezionare la cornice sulla terza pagina con lo strumento Selezione. Il testo è giustificato con ultima riga a sinistra.
3. Annotare unità orizzontali/verticali, origine dei righelli, punto zero, livello attivo e stato di ridisegno. Preparare anche una cornice sintetica giustificata con abbondante spazio verticale.
4. Eseguire lo script dal pannello **Finestra → Utility → Script**. Per la distribuzione usare l'artefatto e il percorso descritti nel README.

## Matrice funzionale

| Prova | Risultato atteso |
| --- | --- |
| Nessun documento; selezione vuota; oggetto non testuale; cursore nel testo | Messaggio comprensibile; nessun nuovo livello/contorno e nessuna preferenza alterata. |
| Annulla, Esc e chiusura della finestra | Nessuna modifica al documento o alle preferenze. |
| Impostazioni iniziali sul campione | Alternanza coerente delle lunghezze; contenuto e formattazione dei caratteri conservati. |
| Due o più cornici ammesse su pagine diverse | Ogni cornice elaborata una volta; geometria riferita alla pagina corretta. |
| Zona zero | Nessun segmento degenere; effetto precedente rimosso o neutralizzato secondo l'azione documentata. |
| Valore massimo ammesso e casualità 0/100 | Nessuna coordinata non finita o larghezza residua non valida; eventuale rifiuto esplicito. |
| Stessi parametri applicati due volte | Risultato riproducibile; numero di oggetti non crescente. |
| Parametri cambiati e nuova applicazione | Sostituzione dei soli contorni della selezione. |
| Rimozione su una di due cornici elaborate | Rimossi soltanto i contorni appartenenti alla cornice scelta. |
| Oggetti utente e livello omonimo | Contenuto utente, visibilità, blocchi e posizione dei livelli estranei conservati. |
| Livello generato visibile con `ignoreWrap` attivo | Applicazione ammessa: questa proprietà riguarda soltanto il comportamento quando il livello è nascosto. |
| Livello generato nascosto dopo l'applicazione | L'impaginazione può conservare il contorno; usare l'azione Rimuovi per eliminare l'effetto. |
| Cornice spostata o ridimensionata dopo l'applicazione | Nuova applicazione riposiziona i contorni; documentare la natura statica dell'effetto. |
| Un annullamento e un ripristino | L'intera applicazione/rimozione viene annullata e ripristinata in una sola operazione. |
| Errore durante creazione o ricomposizione | Nessun risultato parziale; contorni precedenti e preferenze ripristinati. |
| Errore dopo creazione del livello o durante cancellazione finale | Livello temporaneo rimosso se vuoto; contorni ripristinati anche tramite copie di recupero; eventuale recupero incompleto segnalato. |
| Layout che causa nuovo testo fuoriuscito o non converge | Operazione rifiutata e stato precedente recuperato. |

## Geometria e tipografia

| Variante | Verifica |
| --- | --- |
| Unità in millimetri, pollici e punti; punto zero personalizzato; pagine affiancate | Contorni nello stesso punto fisico; preferenze originali ripristinate. |
| Margini interni diversi sui quattro lati | Rientro calcolato sulla zona utile del testo. |
| Prima baseline personalizzata, griglia, interlinea automatica diversa da 120%, corpi misti | Contorni collocati sulle righe reali; nessuna deriva progressiva. |
| Più paragrafi, spazio prima/dopo, ultime righe brevi | Contorni sulle sole fasce occupate; nessun salto spurio. |
| Rientri e compositori diversi | Risultato conforme alle precondizioni oppure rifiuto con motivazione; nessuna accettazione silenziosamente errata. |
| Default oggetto con offset di contorno, inversione, tratto o effetti personalizzati | Risultato indipendente dai default ereditati. |
| `ignoreWrap` e contorno limitato al testo sottostante | Rifiuto o gestione documentata; nessun successo dichiarato senza effetto. |
| Interfaccia italiana/inglese e Windows/macOS | Nessuna dipendenza da nomi localizzati di campioni o separatori di percorso. |
| Anteprima normale, sovrastampa ed esportazione PDF | Contorni invisibili e impaginazione coerente in uscita. |

Provare separatamente i casi non supportati elencati in [AUDIT.md](AUDIT.md): trasformazioni, forme irregolari, gruppi/ancoraggi, più colonne, auto-size, concatenazioni, RTL/verticale, tabelle/note, sovrapposizioni e cornici non sulla pagina. L'esito atteso è un rifiuto prima della modifica, con spiegazione specifica. Controllare che una selezione mista non lasci un'applicazione parziale.

## Registrazione dell'esito

Per ogni problema annotare passi minimi, parametri, messaggio completo, screenshot e differenze nel numero di contorni. Separare sempre **test locali superati**, **test nativi superati** e **test ancora da eseguire**. Solo dopo la matrice nell'host si può dichiarare verificata la compatibilità operativa con quella specifica versione e piattaforma.
