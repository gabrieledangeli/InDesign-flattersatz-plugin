# Anteprima tipografica senza contorni

## Scopo e stato

`dist/flattersatz-preview.jsx` è un prototipo per confrontare una bandiera ottenuta con la formattazione del testo con il metodo storico di Flattersatz. Il risultato si trova in un **nuovo documento separato**. Il documento sorgente rimane invariato.

Il target è InDesign 2026, versione 21.6. **Il prototipo non è ancora stato eseguito dentro InDesign:** nell'ambiente di sviluppo l'applicazione non è installata. I test locali verificano il codice e i modelli simulati. La duplicazione fra documenti, le misure e la composizione effettiva devono superare le prove native in [TESTING.md](TESTING.md).

## Uso

1. Installare `flattersatz-preview.jsx` nel pannello Script, seguendo il [README](../README.md).
2. Aprire un documento con i font disponibili e selezionare una sola cornice di testo semplice, con lo strumento Selezione.
3. Eseguire il prototipo e scegliere la zona della bandiera.
4. Confrontare le pagine del nuovo documento, controllando anche spaziatura e leggibilità.
5. Chiudere il documento di confronto senza salvarlo per eliminare l'anteprima, oppure salvarlo separatamente per discuterne i risultati.

Questa versione non applica la variante al sorgente. Dopo aver modificato parole, font o geometria, eseguire una nuova anteprima dal sorgente. Le copie già aperte non si aggiornano automaticamente.

La zona accetta valori da 0 a 100, con valore iniziale 15. Nel prototipo influenza il punteggio delle lunghezze e della variazione fra righe vicine. Non impone un rientro esatto né un'alternanza rigida. Il valore 0 genera comunque il confronto: non è un comando di rimozione.

## Le varianti

| Variante | Contenuto |
| --- | --- |
| Originale | Copia della cornice selezionata per controllare il risultato di partenza. |
| Bandiera nativa | Copia allineata a sinistra, composta con gli strumenti nativi di InDesign. |
| Ottimizzata | Copia con gruppi di parole tenuti insieme tramite l'attributo **No Break**, secondo un piano calcolato. |
| Metodo storico | Copia con gli oggetti invisibili di contorno, quando la giustificazione del sorgente consente questo confronto. Se non è disponibile, la quarta pagina lo segnala e il messaggio finale ne spiega il motivo. |

La variante ottimizzata non inserisce interruzioni forzate, non riscrive le parole e non usa oggetti di contorno. Le copie conservano font, corpo, stile e tracking. Nelle varianti nativa e ottimizzata il testo viene allineato a sinistra, con sillabazione e bilanciamento disattivati, spaziatura delle parole al 100%, spaziatura delle lettere allo 0% e scala dei glifi al 100%. Rimane il compositore dei paragrafi sorgente. La variante ottimizzata aggiunge inoltre i vincoli No Break: queste due varianti non sono copie visivamente identiche al sorgente.

## Come funziona

Il prototipo misura il testo tramite InDesign su copie temporanee. Calcola una proposta di fine-riga e applica No Break ai gruppi scelti nella copia ottimizzata. Poi fa ricomporre il testo e confronta i fine-riga effettivi con il piano. Se InDesign produce un risultato diverso o il testo non entra nella cornice, l'operazione viene rifiutata.

Il piano considera il paragrafo intero. Il punteggio favorisce righe nella fascia richiesta, differenze moderate fra righe vicine e un'ultima riga non troppo corta. Non impone un'alternanza rigida e non comprende ancora valutazioni del significato delle parole o una sillabazione controllata. Vengono considerate soltanto sequenze in cui ogni gruppo entra nella cornice e due gruppi consecutivi non possono entrare insieme: questo rende gli a capo rappresentabili tramite No Break.

Le misure sono memorizzate durante la ricerca. La crescita di una riga candidata si ferma quando supera la larghezza disponibile, assumendo che aggiungere parole e spazi aumenti la larghezza naturale. La verifica finale nell'host resta obbligatoria. Il budget è di 4.000 misure per paragrafo e 6.000 per anteprima.

I test locali confrontano il piano con un'enumerazione completa dei casi piccoli. In un esempio sintetico largo 100 punti, la scelta che riempie ogni riga prima di passare alla successiva produce larghezze `[97, 95, 95, 9]`. Il piano globale produce `[84, 95, 78, 39]`, con lo stesso numero di righe e senza modificare gli spazi. Il punteggio passa da circa 11,986 a 4,948. È una verifica del criterio numerico su misure simulate, non un confronto visivo eseguito in InDesign.

No Break impedisce la separazione di un gruppo di parole. **Non impone da solo una fine-riga dopo quel gruppo.** La verifica della composizione reale è quindi parte necessaria del prototipo. L'obiettivo è esplorare una bandiera controllata, non certificare automaticamente una composizione svizzera corretta per ogni testo.

## Limiti

Il prototipo accetta un insieme limitato di cornici rettangolari, indipendenti, orizzontali, a una colonna e con testo da sinistra a destra. Ogni paragrafo può avere al massimo 80 gruppi di parole separabili. Sono ammessi al massimo 20 paragrafi, 6.000 caratteri e 6.000 misure candidate per esecuzione. La cornice deve essere larga da 72 a 1.200 punti e alta da 72 a 2.000 punti. Non è pensato per libri, concatenazioni di cornici o composizioni complesse.

Sono esclusi anche griglie, stili nidificati o GREP, elenchi, rientro della prima riga, tabulazioni, ritorni forzati e caratteri discrezionali. Rimuovere gli spazi ordinari all'inizio o alla fine dei paragrafi. I vincoli No Break già presenti vengono rispettati. Caratteri Unicode rappresentati da coppie surrogate, come molte emoji, non sono supportati in questa prima versione. Gli altri limiti della cornice sono spiegati nei messaggi di validazione. Se una misura o una composizione non è verificabile, il prototipo si ferma.

Una copia in un altro documento può risentire di stili e preferenze del documento di destinazione. Controllare soprattutto font, corpi, tracking, griglie e fine-riga dell'originale copiato. Un confronto valido richiede condizioni coerenti fra le varianti.

Il prototipo usa ExtendScript. Non registra un nuovo motore di composizione e non offre un pannello persistente. Un futuro pannello UXP potrebbe migliorarne l'uso, ma non cambierebbe da solo il metodo tipografico. Un compositore nativo richiederebbe uno studio separato sul SDK C++ attuale.

## Riferimenti Adobe

- [TextFrame](https://developer.adobe.com/indesign/uxp/dom/api/t/text-frame/): `duplicate()` accetta una pagina come destinazione.
- [InsertionPoint](https://developer.adobe.com/indesign/uxp/dom/api/i/insertion-point/): `horizontalOffset` e `baseline` espongono misure della composizione. La differenza fra due offset è una larghezza utile solo quando gli estremi appartengono alla stessa riga.
- [Paragraph](https://developer.adobe.com/indesign/uxp/dom/api/p/paragraph/): compositore, allineamento, spaziatura e proprietà `noBreak`.
- [Document](https://developer.adobe.com/indesign/uxp/dom/api/d/document/): `recompose()` richiede una nuova composizione del documento.

Queste API documentano le operazioni impiegate. Non sostituiscono il collaudo del prototipo nel motore Adobe.
