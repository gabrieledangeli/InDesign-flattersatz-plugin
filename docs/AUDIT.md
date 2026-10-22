# Analisi tecnica e aggiornamento di Flattersatz

Data di verifica: **22 ottobre 2026**. Revisione storica analizzata: `04d6ab6`.

## Versione di riferimento e limiti della verifica

La versione stabile più recente riportata nelle [note ufficiali Adobe](https://helpx.adobe.com/indesign/desktop/whats-new/release-notes.html), consultate alla data sopra indicata, è **InDesign 2026, versione 21.6**, pubblicata a settembre 2026. Questo è il riferimento dell'aggiornamento; le versioni beta non fanno parte del target.

Il progetto è uno **script ExtendScript**, non un plug-in binario del SDK né un pannello UXP. L'aggiornamento mantiene questo formato e la sintassi ES3. Una conversione a UXP richiederebbe anche modifiche a interfaccia, collezioni DOM e confronti degli enumeratori: rinominare semplicemente un file in `.idjs` non sarebbe sufficiente. Vedere la [guida Adobe alla migrazione](https://developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/).

La verifica comprende sorgenti, cronologia, struttura del campione IDML, documentazione Adobe e controlli automatici locali. **InDesign non è installato nell'ambiente di lavoro: composizione tipografica, ScriptUI, annullamento/ripristino ed esportazione non sono stati verificati nell'applicazione 21.6.** I test con oggetti simulati non certificano il comportamento del motore Adobe. È disponibile anche lo script nativo [indesign-smoke.jsx](../tests/indesign-smoke.jsx), da eseguire in InDesign; il protocollo completo è in [TESTING.md](TESTING.md). La prontezza per l'uso operativo dipende dall'esito di queste prove. Nessuna analisi statica può garantire l'assenza di ogni possibile errore su documenti arbitrari.

## Comportamento originale

Nella revisione storica `04d6ab6`, `indesign/flattersatz/flattersatz.js` carica `helpers.js`, che importa Underscore 1.4.4 soltanto per estrarre l'ultimo elemento di un percorso. Se esiste un documento, lo script imposta le unità in punti, disabilita il ridisegno e presenta due cursori: zona di frastagliatura, inizialmente 15%, e casualità, inizialmente 0%.

L'algoritmo previsto crea un livello con il nome del file e una linea grafica invisibile per ogni riga di testo. La linea applica un contorno di testo rettangolare dal margine destro verso sinistra: le righe alternate vengono accorciate. A casualità zero, una riga avrebbe rientro zero e la successiva il 15% della larghezza della cornice. Il testo rimane giustificato rispetto alla larghezza disponibile; il contenuto non viene riscritto. Non è quindi una conversione alla normale impostazione di paragrafo allineata a sinistra.

Il comportamento effettivo della revisione storica è diverso: il ciclo esterno confronta `i < len` invece di `n < len`. `i` è una variabile locale dichiarata nel ciclo interno e inizialmente vale `undefined`; la condizione risulta falsa e **nessuna linea viene creata**. In condizioni normali viene aggiunto soltanto il livello. Gli altri difetti del generatore restano latenti finché questo errore non viene corretto.

## Problemi individuati

Le posizioni sotto si riferiscono alla revisione storica, non alla nuova disposizione dei moduli. «Alta» indica mancato funzionamento o rischio concreto di alterazione inattesa del documento; «Media» indica un risultato errato in configurazioni valide; «Bassa» indica manutenzione o chiarezza.

| Gravità | Posizione originale | Difetto e conseguenza | Intervento |
| --- | --- | --- | --- |
| Alta | `flattersatz.js:84` | Il ciclo usa `i` invece di `n`; non elabora la selezione. | Separazione della raccolta delle cornici dalla generazione. |
| Alta | `flattersatz.js:23–28,72–76,121` | Selezione vuota, annullamento o eccezioni saltano il ripristino: ridisegno disabilitato e unità modificate. | Nessuna mutazione prima della conferma; ripristino in `finally`. |
| Alta | `helpers.js:15–29` | Il ripristino forza il ridisegno a `true` invece di ripristinare il valore precedente; unità salvate in globali condivise. | Stato precedente locale all'operazione. |
| Alta | `flattersatz.js:106` | `graphicLines.add({layer: script_name})` non corrisponde alla firma documentata e `layer` non è la proprietà `itemLayer`. | Creazione con un oggetto `Layer` esplicito. |
| Alta | `flattersatz.js:102–118` | La composizione cambia mentre si itera una collezione viva; righe aggiunte o spostate possono ricevere contorni incoerenti. | Istantanee numeriche, ricomposizione esplicita e convergenza con limite. |
| Alta | `flattersatz.js:82–118` | Nessuna associazione fra contorni e cornice: ogni esecuzione accumula oggetti e non esiste una rimozione affidabile. | Etichette di proprietà e sostituzione/rimozione mirata. |
| Alta | Generazione | Nessuna transazione o recupero dopo errore: contorni parziali e testo fuoriuscito possono rimanere nel documento. | Preparazione temporanea, ripristino su errore e singola operazione annullabile. |
| Alta | Generazione | Il contorno può influenzare altre cornici sovrapposte o testo concatenato non selezionato. | Controlli preventivi delle configurazioni supportate e delle interferenze. |
| Media | `flattersatz.js:92–103` | Altezza calcolata dal primo carattere: ignora baseline reale, griglia, interlinea mista, spazi fra paragrafi e prima baseline. | Metriche effettive di ciascuna riga. |
| Media | `flattersatz.js:98–99` | L'interlinea automatica è assunta sempre al 120%, anche quando il paragrafo usa una percentuale diversa. | Nessuna interlinea stimata. |
| Media | `flattersatz.js:92–104` | La larghezza comprende i margini interni e ignora geometrie trasformate, colonne e rientri. | Larghezza utile, controlli geometrici e rifiuto esplicito dei casi non gestiti. |
| Media | `flattersatz.js:106` | `parentPage` può essere assente, per esempio sul tavolo di montaggio. | Validazione della pagina e del contenitore. |
| Media | `flattersatz.js:109,112` | Le coordinate orizzontali sono invertite rispetto all'ordine documentato dei limiti geometrici; vengono richiesti anche segmenti di lunghezza zero. | Coordinate ordinate; nessun oggetto per rientro nullo. |
| Media | `flattersatz.js:111–112` | La casualità può raddoppiare la zona richiesta: al 100% il contorno può oltrepassare l'intera larghezza del testo. | Limiti numerici e controllo della larghezza residua. |
| Media | `flattersatz.js:115` | Offset, lato, inversione e aspetto ereditano valori predefiniti del documento; l'effetto può cambiare senza cambiare i cursori. | Proprietà necessarie impostate esplicitamente. |
| Media | Generazione | `ignoreWrap`, ordine dei livelli, compositore e preferenze di contorno possono rendere il risultato nullo o diverso dall'atteso. | Precondizioni esplicite e verifica dopo ricomposizione. |
| Media | `flattersatz.js:116` | Il campione `"Paper"` dipende dalla localizzazione; il tratto rimane dipendente dai valori predefiniti. | Aspetto neutro senza dipendenza dal nome inglese del campione. |
| Media | `helpers.js:47–52` | Tutti gli errori di creazione del livello sono trattati come «esiste già»; un livello omonimo può essere bloccato, nascosto o appartenere all'utente. | Identificazione della proprietà, gestione esplicita degli errori, nessuna acquisizione per solo nome. |
| Media | Selezione e testo | Nessun controllo per cornici vuote, bloccate, non giustificate, sovracomposte o configurazioni complesse. | Messaggi specifici prima di modificare il documento. |
| Bassa | Cursori | Valore visualizzato frazionario e valore applicato troncato possono differire; manca la validazione finale. | Valori interi coerenti e validazione all'invio. |
| Bassa | `helpers.js:61–79` | Separatore del percorso scelto dal sistema operativo; rimozione dell'estensione dal primo punto. | Utilità inizialmente corrette e testate, poi rimosse insieme ai relativi test perché non utilizzate dagli script attuali. |
| Bassa | Repository | Nessun controllo automatico, istruzioni d'installazione minime e immagine remota riferita a un'altra repository. | Documentazione, distribuzione riproducibile e test di regressione. |

La firma di creazione e l'ordine delle coordinate sono descritti nelle API Adobe di [GraphicLines](https://developer.adobe.com/indesign/uxp/dom/api/g/graphic-lines/) e [GraphicLine](https://developer.adobe.com/indesign/uxp/dom/api/g/graphic-line/). Le metriche `baseline`, `ascent` e `descent` provengono da [Line](https://developer.adobe.com/indesign/uxp/dom/api/l/line/). Le interazioni con contorni, margini interni e livelli sono documentate in [TextWrapPreference](https://developer.adobe.com/indesign/uxp/dom/api/t/text-wrap-preference/), [TextFramePreference](https://developer.adobe.com/indesign/uxp/dom/api/t/text-frame-preference/) e [TextPreference](https://developer.adobe.com/indesign/uxp/dom/api/t/text-preference/).

## Architettura del metodo a contorni

`core.js` separa il calcolo geometrico dall'accesso al DOM: riceve numeri e impostazioni e produce un piano di contorni. La casualità è deterministica rispetto alla cornice e all'indice di riga per permettere risultati riproducibili e confrontare le ricomposizioni. La profondità è limitata per conservare una larghezza minima di testo. Rientro nullo significa nessun oggetto. `ui.js` raccoglie le impostazioni e distingue applicazione e rimozione; `flattersatz.js` coordina interfaccia e adattatore.

I contorni attuali sono **rettangoli molto sottili**, senza riempimento o tratto, non stampabili e a opacità zero: evitano segmenti degeneri e coordinate invertite. Stile base e proprietà di contorno vengono impostati esplicitamente. Le vecchie utilità `indesign/_common/helpers.js`, i relativi test e `_libs/underscore-1.4.4.js` sono stati rimossi perché non erano utilizzati dagli script attuali. I riferimenti a questi file nelle sezioni precedenti descrivono la revisione storica e le correzioni iniziali.

`npm run build` produce due file installabili: `dist/flattersatz.jsx` per il metodo a contorni e `dist/flattersatz-preview.jsx` per l'anteprima tipografica. L'anteprima riutilizza `core.js` e `host.js` per la validazione e il confronto storico. Il suo algoritmo senza contorni e i suoi limiti sono descritti nella [guida dedicata](TYPOGRAPHIC-PREVIEW.md). Il [README principale](../README.md) raccoglie installazione, uso e collegamento al video storico.

`host.js` raccoglie le cornici selezionate, ne controlla le precondizioni e salva lo stato delle preferenze che deve cambiare. Legge metriche reali dopo la composizione, prepara i nuovi contorni e ricompone. La larghezza viene dai margini della cornice e dai rientri, non dalla lunghezza già accorciata delle righe. Confronta metriche e intervalli di testo per un massimo di **12 passaggi**; ammette fino a **5000 righe per cornice**. Controlla infine che l'estremità delle righe non oltrepassi il contorno richiesto, con una tolleranza di un punto. Se il layout non converge, ignora il contorno o il testo diventa fuoriuscito, l'operazione fallisce in modo esplicito. Interlinee troppo strette per isolare le fasce di contorno vengono rifiutate. L'azione Rimuovi e l'applicazione con zona zero eliminano soltanto gli oggetti associati alla selezione.

Gli oggetti generati hanno etichette che identificano lo script e la cornice proprietaria. I contorni precedenti vengono disabilitati temporaneamente, conservati durante la preparazione e rimossi soltanto dopo una sostituzione riuscita. Prima della cancellazione finale vengono duplicate copie di recupero inattive. Un errore elimina i nuovi contorni e ripristina quelli precedenti; se la cancellazione era già iniziata, usa le copie di recupero. Un eventuale errore durante il recupero viene segnalato e richiede l'annullamento dell'operazione. Livelli e oggetti senza etichette di proprietà restano estranei alla pulizia, anche se hanno lo stesso nome. I vecchi contorni privi di etichette non possono essere attribuiti con sicurezza e richiedono un controllo manuale.

Il livello generato è visibile e sbloccato. `Layer.ignoreWrap` riguarda esclusivamente i contorni di un **livello nascosto**: non è un interruttore generale del contorno. Per i nuovi livelli è impostato a `false`, quindi nascondere il livello non equivale a rimuovere l'effetto. Con l'opzione «Text Wrap Only Affects Text Beneath» attiva, il livello dei contorni deve essere in cima. Vedere [Layer](https://developer.adobe.com/indesign/uxp/dom/api/l/layer/).

La transazione usa `app.doScript` con annullamento dell'intero script; il raggruppamento in una singola voce della cronologia non sostituisce la gestione esplicita degli errori. Un blocco `finally` ripristina unità di script e documento, origine e punto zero, livello attivo, ridisegno e Smart Text Reflow, disattivato temporaneamente durante la composizione. Gli errori di ripristino sono segnalati. La firma dell'operazione è nella documentazione di [Application](https://developer.adobe.com/indesign/uxp/dom/api/a/application/).

## Campo di applicazione

Il caso supportato è una selezione di cornici rettangolari, non trasformate, a colonna singola, direttamente sulla pagina, con allineamento verticale in alto e testo orizzontale da sinistra a destra giustificato. Il testo deve avere font disponibili, margini interni validi e nessuna fuoriuscita prima dell'effetto. I contorni sono oggetti statici: dopo modifiche a contenuto, font, dimensioni o posizione occorre applicare nuovamente l'effetto.

Richiedono un algoritmo dedicato e non devono ricevere un risultato approssimativo: cornici ruotate, inclinate, specchiate o scalate; forme non rettangolari o con effetti angolo; oggetti raggruppati o ancorati; tavolo di montaggio e pagine mastro; colonne multiple; dimensionamento automatico; testo verticale o RTL; tabelle, note a piè di pagina/finali; cornici sovrapposte; concatenazioni; capolettera, rientri negativi o sull'ultima riga. Gli elementi testuali estranei sulla stessa doppia pagina richiedono controlli di interferenza, compresi testo su tracciato ed elementi delle pagine mastro. Il controllo finale nell'host deve verificare anche testi con rientri, spaziature o interlinee particolari.

## Campione storico

L'archivio `flattersatz.idml` contiene un documento **DOM 7.5 (CS5.5)**, tre pagine e una storia principale non concatenata sulla terza pagina. La cornice ha larghezza di circa 226,77 punti; il testo usa **Helvetica Bold 10 pt**, interlinea **14 pt**, compositore a riga singola e giustificazione con ultima riga a sinistra. Non contiene contorni prodotti dallo script.

Il campione è utile per confrontare l'intento originario, ma non costituisce una suite completa. Helvetica può risultare assente: registrare l'eventuale sostituzione del font, perché modifica la composizione. Conservare il file storico e lavorare su una copia convertita da InDesign corrente.
