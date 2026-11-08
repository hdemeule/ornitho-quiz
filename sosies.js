'use strict';
/* Groupes de sosies. Critères alignés sur Le Guide ornitho (Delachaux).
   dims : critères dans l'ordre où on les découvre sur le terrain (sert au jeu « Indice par indice »).
   read : ordre de lecture conseillé (ce qu'on regarde en premier).
   pairs : duels classiques [A, B, critère qui tranche, explication]. */
const SOSIES = [
{
  id: 'verts', name: 'Pouillots et hypolaïs', sub: 'Les petits verts',
  ctx: 'Petits insectivores olive et jaunâtres qui fouillent le feuillage. La teinte varie avec la lumière et l\'usure : ne pas s\'y fier.',
  dims: [['milieu', 'Milieu et saison'], ['silhouette', 'Silhouette et bec'], ['pattes', 'Pattes'], ['proj', 'Projection primaire'], ['tete', 'Tête et aile'], ['voix', 'Voix']],
  read: ['pattes', 'proj', 'tete', 'voix'],
  sp: [
    { n: 'Pouillot véloce', sci: 'Phylloscopus collybita', v: { milieu: 'Partout où il y a des arbres ; seul pouillot présent en hiver', silhouette: 'Petit et rond, bec fin, agite la queue vers le bas', pattes: 'Sombres', proj: 'Courte', tete: 'Sourcil discret, trait oculaire peu marqué, teinte terne', voix: '« tchip-tchap » mécanique ; cri « huit » d\'une syllabe' } },
    { n: 'Pouillot fitis', sci: 'Phylloscopus trochilus', v: { milieu: 'Jeunes boisements, friches arborées ; absent d\'octobre à mars', silhouette: 'Un peu plus élancé, bec fin, agite peu la queue', pattes: 'Claires, couleur chair', proj: 'Longue', tete: 'Sourcil et trait oculaire nets, teinte plus jaune', voix: 'Cascade descendante et mélancolique ; cri « hu-ii » en deux syllabes' } },
    { n: 'Pouillot siffleur', sci: 'Phylloscopus sibilatrix', v: { milieu: 'Hêtraies au sous-bois dégagé, d\'avril à août', silhouette: 'Plus grand, longues ailes, queue courte, bec fin', pattes: 'Claires', proj: ['Très longue', 'L'], tete: 'Gorge et sourcil jaune vif tranchant sur un ventre blanc pur', voix: 'Trille qui accélère, comme une pièce qui tourne sur une table' } },
    { n: 'Hypolaïs ictérine', sci: 'Hippolais icterina', v: { milieu: 'Parcs et bosquets, de mai à août', silhouette: 'Plus gros qu\'un pouillot, tête plate, bec large', pattes: ['Gris bleuté', 'gris'], proj: 'Longue', tete: 'Bec à base orangée, panneau alaire pâle', voix: 'Puissant et grinçant, notes qui dérapent comme une fête foraine' } },
    { n: 'Hypolaïs polyglotte', sci: 'Hippolais polyglotta', v: { milieu: 'Friches et haies ensoleillées, de mai à août', silhouette: 'Plus gros qu\'un pouillot, tête plate, bec large', pattes: ['Brun gris', 'gris'], proj: 'Courte', tete: 'Bec large, pas de panneau alaire', voix: 'Débit rapide et continu, commence souvent par des cris de moineau' } }
  ],
  pairs: [
    ['Pouillot véloce', 'Pouillot fitis', 'pattes', 'Pattes sombres chez le véloce, claires chez le fitis. La projection (courte contre longue) et le chant confirment. En hiver, c\'est presque toujours un véloce.'],
    ['Pouillot fitis', 'Pouillot siffleur', 'tete', 'Le siffleur a la gorge et le sourcil jaune vif sur un ventre blanc pur. Le fitis n\'a pas ce contraste.'],
    ['Pouillot véloce', 'Pouillot siffleur', 'tete', 'Jaune vif et blanc pur chez le siffleur, olive terne sans contraste chez le véloce.'],
    ['Hypolaïs ictérine', 'Hypolaïs polyglotte', 'proj', 'Projection longue et panneau alaire pâle chez l\'ictérine, courte et sans panneau chez la polyglotte.'],
    ['Pouillot fitis', 'Hypolaïs ictérine', 'silhouette', 'Bec large et tête plate chez l\'hypolaïs, bec fin de pouillot chez le fitis.']
  ]
},
{
  id: 'roseaux', name: 'Rousserolles et locustelle', sub: 'Les petits bruns des roseaux',
  ctx: 'Passereaux bruns sans marque qui vivent cachés dans la végétation dense. Le milieu et le chant font souvent tout le travail.',
  dims: [['milieu', 'Milieu'], ['silhouette', 'Silhouette'], ['tete', 'Tête'], ['dessus', 'Dessus'], ['voix', 'Chant']],
  read: ['tete', 'milieu', 'voix'],
  sp: [
    { n: 'Phragmite des joncs', sci: 'Acrocephalus schoenobaenus', v: { milieu: 'Roselières et prairies humides avec buissons', silhouette: 'Petit et compact', tete: 'Large sourcil crème, calotte sombre striée', dessus: 'Dos rayé, croupion roux', voix: 'Précipité et saccadé, grincements et notes flûtées, vol nuptial' } },
    { n: 'Rousserolle effarvatte', sci: 'Acrocephalus scirpaceus', v: { milieu: 'Roselière pure, grimpe le long des tiges', silhouette: ['Allongée, front fuyant', 'm'], tete: ['Unie, sourcil crème diffus', 'u'], dessus: 'Brun roux uni, croupion plus roux', voix: 'Régulier et monotone, motifs répétés deux ou trois fois' } },
    { n: 'Rousserolle verderolle', sci: 'Acrocephalus palustris', v: { milieu: 'Orties, friches, colza ; rarement en roselière', silhouette: ['Comme l\'effarvatte, tête plus ronde', 'm'], tete: ['Unie, sourcil discret', 'u'], dessus: 'Brun olive uni, pointes des primaires liserées de clair', voix: 'Riche et rapide, plein d\'imitations et de sons nasillards' } },
    { n: 'Rousserolle turdoïde', sci: 'Acrocephalus arundinaceus', v: { milieu: 'Grandes roselières inondées', silhouette: 'Presque la taille d\'une grive, bec fort', tete: ['Unie, sourcil net', 'u'], dessus: 'Brun roux uni', voix: 'Grave et rauque, « kara-kara-kiet »' } },
    { n: 'Locustelle tachetée', sci: 'Locustella naevia', v: { milieu: 'Friches humides et hautes herbes, se cache au sol', silhouette: 'Queue large et arrondie, sous-caudales longues', tete: ['Unie, sourcil très faible', 'u'], dessus: 'Brun olive finement tacheté, sous-caudales striées', voix: 'Grésillement continu, comme un moulinet de pêche' } }
  ],
  pairs: [
    ['Rousserolle effarvatte', 'Rousserolle verderolle', 'milieu', 'À vue, presque impossible. L\'effarvatte vit dans la roselière, la verderolle dans les orties et les friches. Le chant tranche : imitations chez la verderolle.'],
    ['Phragmite des joncs', 'Rousserolle effarvatte', 'tete', 'Le phragmite a une tête dessinée (sourcil crème large, calotte striée). Les rousserolles ont une tête unie.'],
    ['Rousserolle effarvatte', 'Rousserolle turdoïde', 'silhouette', 'La turdoïde a presque la taille d\'une grive et un bec fort. Son chant grave et rauque confirme.'],
    ['Locustelle tachetée', 'Rousserolle verderolle', 'voix', 'Grésillement continu et monotone de la locustelle, contre le chant varié plein d\'imitations de la verderolle.']
  ]
},
{
  id: 'fauvettes', name: 'Fauvettes sans marque', sub: 'Gris et bruns des buissons',
  ctx: 'Fauvettes discrètes, surtout la femelle et le jeune. Le dessin de la gorge et de la joue sépare tout le groupe.',
  dims: [['milieu', 'Milieu'], ['gorge', 'Gorge'], ['tete', 'Tête'], ['aile', 'Aile'], ['voix', 'Chant']],
  read: ['gorge', 'tete', 'aile'],
  sp: [
    { n: 'Fauvette des jardins', sci: 'Sylvia borin', v: { milieu: 'Sous-bois et lisières denses', gorge: ['Grise comme la poitrine, sans contraste', 'g'], tete: 'Ronde, œil cerné de pâle, bec court et épais', aile: 'Unie', voix: 'Babil long, roulé et continu' } },
    { n: 'Fauvette grisette', sci: 'Curruca communis', v: { milieu: 'Haies, ronciers, friches ouvertes', gorge: ['Blanc pur, souvent gonflée', 'b'], tete: 'Calotte grise chez le mâle, œil cerclé de blanc', aile: 'Liserés roux bien visibles', voix: 'Phrase courte et grinçante, souvent en vol chanté' } },
    { n: 'Fauvette babillarde', sci: 'Curruca curruca', v: { milieu: 'Haies hautes et jardins à buissons', gorge: ['Blanche', 'b'], tete: 'Joues sombres formant un masque', aile: 'Grise, sans roux', voix: 'Courte crécelle sur une note, après un gazouillis' } },
    { n: 'Fauvette à tête noire (femelle)', w: 'Fauvette à tête noire', sci: 'Sylvia atricapilla', v: { milieu: 'Partout où il y a buissons et arbres', gorge: ['Grise', 'g'], tete: 'Calotte rousse nette (noire chez le mâle)', aile: 'Unie, gris brun', voix: 'Babil qui finit en phrase flûtée éclatante' } }
  ],
  pairs: [
    ['Fauvette des jardins', 'Fauvette à tête noire (femelle)', 'tete', 'La femelle de tête noire a une calotte rousse nette. La fauvette des jardins n\'a aucune marque.'],
    ['Fauvette des jardins', 'Fauvette grisette', 'gorge', 'Gorge blanc pur chez la grisette, gorge grise sans contraste chez la fauvette des jardins. La grisette a aussi des liserés roux à l\'aile.'],
    ['Fauvette grisette', 'Fauvette babillarde', 'tete', 'Masque sombre sur les joues chez la babillarde. La grisette a des liserés roux à l\'aile, la babillarde une aile grise.'],
    ['Fauvette des jardins', 'Fauvette babillarde', 'tete', 'Masque sombre et gorge blanche chez la babillarde, tête unie et gorge grise chez la fauvette des jardins.']
  ]
},
{
  id: 'alouettes', name: 'Alouettes', sub: 'Les bruns des champs',
  ctx: 'Toutes striées de brun et vivent au sol. On les sépare surtout en vol, par la queue et le bord de l\'aile.',
  dims: [['milieu', 'Milieu'], ['silhouette', 'Silhouette'], ['queue', 'Queue'], ['aile', 'Aile en vol'], ['tete', 'Tête'], ['voix', 'Voix']],
  read: ['queue', 'aile', 'tete'],
  sp: [
    { n: 'Alouette des champs', sci: 'Alauda arvensis', v: { milieu: 'Grandes cultures et prairies ouvertes', silhouette: 'Assez grande, longue queue', queue: 'Longue, bords blancs', aile: 'Bord de fuite blanc', tete: 'Petite huppe qu\'elle dresse ou abaisse', voix: 'Chant interminable en vol stationnaire très haut' } },
    { n: 'Alouette lulu', sci: 'Lullula arborea', v: { milieu: 'Landes, coupes forestières, lisières sableuses', silhouette: 'Petite et trapue', queue: 'Très courte, coins blancs', aile: 'Marque noire et blanche au poignet, pas de bord de fuite blanc', tete: 'Sourcils clairs qui se rejoignent sur la nuque', voix: '« lu-lu-lu » doux et descendant, en vol circulaire' } },
    { n: 'Cochevis huppé', sci: 'Galerida cristata', v: { milieu: 'Terrains vagues, parkings, zones industrielles', silhouette: 'Trapu, bec plus long', queue: 'Courte, sans blanc, bords chamois', aile: 'Dessous roussâtre, pas de bord blanc', tete: 'Longue huppe pointue toujours visible', voix: 'Sifflements flûtés et mélancoliques, depuis le sol ou un toit' } }
  ],
  pairs: [
    ['Alouette des champs', 'Alouette lulu', 'queue', 'Queue longue bordée de blanc chez l\'alouette des champs, très courte chez la lulu. En vol, la lulu n\'a pas de bord de fuite blanc mais une marque au poignet.'],
    ['Alouette des champs', 'Cochevis huppé', 'tete', 'Longue huppe pointue toujours visible chez le cochevis, petite huppe qu\'on ne voit pas toujours chez l\'alouette des champs. Le cochevis n\'a aucun blanc dans la queue.'],
    ['Alouette lulu', 'Cochevis huppé', 'tete', 'Sourcils clairs qui se rejoignent sur la nuque chez la lulu, longue huppe pointue chez le cochevis.']
  ]
},
{
  id: 'pipits', name: 'Pipits', sub: 'Petits bruns striés',
  ctx: 'Quatre espèces presque identiques à vue. Le milieu, la couleur des pattes et le cri décident.',
  dims: [['milieu', 'Milieu'], ['pattes', 'Pattes'], ['dessous', 'Dessous'], ['queue', 'Bords de la queue'], ['voix', 'Cri']],
  read: ['milieu', 'pattes', 'voix'],
  sp: [
    { n: 'Pipit farlouse', sci: 'Anthus pratensis', v: { milieu: 'Prairies et polders, jamais en forêt', pattes: ['Rosées, ongle arrière long', 'r'], dessous: 'Stries des flancs larges et diffuses', queue: ['Blancs', 'b'], voix: '« ist-ist-ist » sec et répété' } },
    { n: 'Pipit des arbres', sci: 'Anthus trivialis', v: { milieu: 'Lisières et clairières, se perche dans les arbres', pattes: ['Rosées, ongle arrière court et courbé', 'r'], dessous: 'Poitrine chamois, stries des flancs fines', queue: ['Blancs', 'b'], voix: '« bzii » unique et rêche' } },
    { n: 'Pipit spioncelle', sci: 'Anthus spinoletta', v: { milieu: 'En hiver au bord de l\'eau douce ; montagne en été', pattes: ['Sombres', 's'], dessous: 'Peu strié, blanchâtre en hiver, sourcil net', queue: ['Blancs', 'b'], voix: '« fist » fin' } },
    { n: 'Pipit maritime', sci: 'Anthus petrosus', v: { milieu: 'Rochers et digues de la côte', pattes: ['Sombres', 's'], dessous: 'Gris olive à stries diffuses, aspect enfumé', queue: 'Gris', voix: 'Proche du spioncelle, plus plein' } }
  ],
  pairs: [
    ['Pipit farlouse', 'Pipit des arbres', 'voix', 'Le cri décide : « ist-ist » répété chez la farlouse, « bzii » unique chez le pipit des arbres. Ensuite le milieu (prairie contre lisière) et l\'ongle arrière.'],
    ['Pipit spioncelle', 'Pipit maritime', 'queue', 'Bords de queue blancs chez le spioncelle, gris chez le maritime. Le milieu aide : eau douce contre rochers de la côte.'],
    ['Pipit farlouse', 'Pipit spioncelle', 'pattes', 'Pattes rosées chez la farlouse, sombres chez le spioncelle.']
  ]
},
{
  id: 'aeriens', name: 'Hirondelles et martinets', sub: 'Les silhouettes du ciel',
  ctx: 'Vus de dessous, à contre-jour, ils se ressemblent. Silhouette et croupion suffisent presque toujours.',
  dims: [['milieu', 'Milieu'], ['silhouette', 'Silhouette et vol'], ['croupion', 'Croupion'], ['dessous', 'Dessous'], ['queue', 'Queue']],
  read: ['silhouette', 'croupion', 'dessous'],
  sp: [
    { n: 'Martinet noir', sci: 'Apus apus', v: { milieu: 'Villes, au-dessus des toits, fin avril à début août', silhouette: ['Ailes en faux, vol raide, ne se pose jamais', 'f'], croupion: ['Sombre', 's'], dessous: 'Tout sombre, gorge pâle', queue: 'Courte, peu fourchue' } },
    { n: 'Martinet à ventre blanc', sci: 'Tachymarptis melba', v: { milieu: 'Falaises et villes du Midi, Alpes', silhouette: ['Ailes en faux, nettement plus grand que le noir', 'f'], croupion: ['Sombre', 's'], dessous: 'Ventre blanc, bande pectorale sombre', queue: 'Courte, peu fourchue' } },
    { n: 'Hirondelle rustique', sci: 'Hirundo rustica', v: { milieu: 'Fermes et étables, au ras des prés', silhouette: ['Vol souple, ailes plus courtes', 'h'], croupion: ['Sombre, bleu noir', 's'], dessous: 'Gorge rouge, collier bleu, dessous crème', queue: 'Longs filets' } },
    { n: 'Hirondelle de fenêtre', sci: 'Delichon urbicum', v: { milieu: 'Nids sous les corniches des maisons', silhouette: ['Petite et trapue, vol souple', 'h'], croupion: 'Blanc pur', dessous: 'Blanc pur', queue: 'Courte et fourchue, sans filets' } },
    { n: 'Hirondelle de rivage', sci: 'Riparia riparia', v: { milieu: 'Rivières et sablières, au-dessus de l\'eau', silhouette: ['La plus petite, vol papillonnant', 'h'], croupion: ['Brun', 'b'], dessous: 'Blanc, bande pectorale brune', queue: 'Courte, peu échancrée' } },
    { n: 'Hirondelle de rochers', sci: 'Ptyonoprogne rupestris', v: { milieu: 'Falaises et gorges de montagne', silhouette: ['Trapue, ailes larges', 'h'], croupion: ['Brun gris', 'b'], dessous: 'Brun gris pâle, sans bande', queue: 'Taches blanches quand elle l\'étale' } }
  ],
  pairs: [
    ['Hirondelle rustique', 'Hirondelle de fenêtre', 'croupion', 'Croupion blanc pur chez l\'hirondelle de fenêtre, sombre chez la rustique, qui a aussi de longs filets et la gorge rouge.'],
    ['Hirondelle de fenêtre', 'Hirondelle de rivage', 'croupion', 'Croupion blanc chez l\'hirondelle de fenêtre, brun chez celle de rivage, qui porte une bande pectorale brune.'],
    ['Hirondelle de rivage', 'Hirondelle de rochers', 'dessous', 'Bande pectorale brune chez l\'hirondelle de rivage, dessous uni chez celle de rochers, qui montre des taches blanches dans la queue.'],
    ['Martinet noir', 'Hirondelle rustique', 'silhouette', 'Ailes en faux et vol raide du martinet, qui ne se pose jamais. L\'hirondelle a un vol souple et se pose sur les fils.'],
    ['Martinet noir', 'Martinet à ventre blanc', 'dessous', 'Ventre blanc chez le martinet à ventre blanc, tout sombre chez le martinet noir.']
  ]
},
{
  id: 'goelands', name: 'Goélands adultes', sub: 'Les gris et blancs',
  ctx: 'Valable pour les adultes. Pour un immature, détermine d\'abord son âge : la teinte change d\'année en année.',
  dims: [['taille', 'Taille'], ['pattes', 'Pattes'], ['manteau', 'Manteau'], ['bec', 'Bec et œil'], ['tete', 'Tête en hiver']],
  read: ['taille', 'pattes', 'manteau', 'tete'],
  sp: [
    { n: 'Goéland cendré', sci: 'Larus canus', v: { taille: 'Petit, à peine plus grand qu\'une mouette rieuse', pattes: 'Vert jaunâtre', manteau: 'Gris moyen', bec: 'Fin, jaune verdâtre, sans tache rouge ; œil sombre', tete: 'Finement striée' } },
    { n: 'Goéland argenté', sci: 'Larus argentatus', v: { taille: ['Grand', 'G'], pattes: ['Roses', 'r'], manteau: 'Gris clair', bec: 'Fort, tache rouge ; œil jaune pâle', tete: 'Striée' } },
    { n: 'Goéland leucophée', sci: 'Larus michahellis', v: { taille: ['Grand', 'G'], pattes: ['Jaunes', 'j'], manteau: 'Gris un ton plus foncé que l\'argenté', bec: 'Tache rouge plus étendue, cercle orbital rouge', tete: 'Blanche, peu striée' } },
    { n: 'Goéland brun', sci: 'Larus fuscus', v: { taille: ['Grand, plus élancé', 'G'], pattes: ['Jaunes', 'j'], manteau: 'Gris ardoise sombre', bec: 'Tache rouge ; ailes qui dépassent longuement la queue', tete: 'Fortement striée' } },
    { n: 'Goéland marin', sci: 'Larus marinus', v: { taille: 'Énorme, le plus grand', pattes: ['Roses', 'r'], manteau: 'Noir', bec: 'Massif', tete: 'Presque blanche' } }
  ],
  pairs: [
    ['Goéland argenté', 'Goéland leucophée', 'pattes', 'Pattes roses chez l\'argenté, jaunes chez le leucophée. Le leucophée a aussi la tête blanche en hiver et un manteau un peu plus foncé.'],
    ['Goéland argenté', 'Goéland cendré', 'bec', 'Bec fin sans tache rouge et œil sombre chez le cendré, qui paraît « doux ». L\'argenté a un bec fort à tache rouge et des pattes roses.'],
    ['Goéland brun', 'Goéland leucophée', 'manteau', 'Tous deux ont les pattes jaunes. Le brun a un manteau gris ardoise sombre et la tête très striée en hiver, le leucophée un manteau gris moyen et la tête blanche.'],
    ['Goéland brun', 'Goéland marin', 'pattes', 'Pattes jaunes chez le brun, roses chez le marin, qui est aussi énorme et a le manteau noir.'],
    ['Goéland argenté', 'Goéland marin', 'manteau', 'Manteau noir et taille énorme chez le marin, manteau gris clair chez l\'argenté. Tous deux ont les pattes roses.']
  ]
},
{
  id: 'becasseaux', name: 'Petits bécasseaux', sub: 'Les gris des vasières',
  ctx: 'En plumage d\'hiver ils sont tous gris dessus et blancs dessous. Juge la taille, le bec et le comportement.',
  dims: [['milieu', 'Milieu'], ['taille', 'Taille'], ['bec', 'Bec'], ['pattes', 'Pattes'], ['comp', 'Comportement et vol']],
  read: ['taille', 'bec', 'comp'],
  sp: [
    { n: 'Bécasseau variable', sci: 'Calidris alpina', v: { milieu: 'Vasières et estrans, en grandes bandes', taille: ['Moyen, sert de référence', 'M'], bec: 'Une tête de long, légèrement arqué', pattes: ['Noires', 'n'], comp: 'Picore et sonde en bandes serrées ; ventre noir en été' } },
    { n: 'Bécasseau sanderling', sci: 'Calidris alba', v: { milieu: 'Plages de sable, ligne du ressac', taille: ['Comme le variable, plus trapu', 'M'], bec: 'Court, droit, noir', pattes: ['Noires', 'n'], comp: 'Court mécaniquement au ras des vagues ; le plus pâle, épaule noire' } },
    { n: 'Bécasseau maritime', sci: 'Calidris maritima', v: { milieu: 'Rochers, digues et brise-lames couverts d\'algues', taille: ['Un peu plus grand, trapu', 'M'], bec: 'Légèrement arqué, base jaune', pattes: 'Jaunes', comp: 'Gris ardoise sombre, se laisse approcher sur les rochers' } },
    { n: 'Bécasseau minute', sci: 'Calidris minuta', v: { milieu: 'Vasières et lagunes, surtout en septembre', taille: 'Minuscule, nettement plus petit', bec: 'Court et droit', pattes: ['Noires', 'n'], comp: 'Très actif ; le juvénile a un « V » clair sur le dos' } },
    { n: 'Bécasseau cocorli', sci: 'Calidris ferruginea', v: { milieu: 'Vasières en migration, août et septembre', taille: ['Un peu plus grand, haut sur pattes', 'M'], bec: 'Long et nettement arqué', pattes: ['Noires, plus longues', 'n'], comp: 'Croupion blanc en vol ; le juvénile a la poitrine chamois' } }
  ],
  pairs: [
    ['Bécasseau variable', 'Bécasseau sanderling', 'comp', 'Le sanderling court comme un jouet mécanique au ras des vagues et c\'est le plus pâle. Le variable picore dans la vase.'],
    ['Bécasseau variable', 'Bécasseau cocorli', 'bec', 'Bec long et nettement arqué chez le cocorli, plus court et à peine arqué chez le variable. En vol, le cocorli montre un croupion blanc.'],
    ['Bécasseau variable', 'Bécasseau minute', 'taille', 'Le minute est minuscule, avec un bec court et droit.'],
    ['Bécasseau variable', 'Bécasseau maritime', 'pattes', 'Pattes jaunes et plumage gris ardoise chez le maritime, toujours sur les rochers. Le variable a les pattes noires.']
  ]
},
{
  id: 'chevaliers', name: 'Chevaliers', sub: 'Les limicoles moyens',
  ctx: 'Silhouettes proches et plumages discrets. La couleur des pattes, le dessin en vol et le cri à l\'envol tranchent.',
  dims: [['milieu', 'Milieu'], ['pattes', 'Pattes'], ['bec', 'Bec'], ['vol', 'Dessin en vol'], ['voix', 'Cri']],
  read: ['pattes', 'vol', 'voix'],
  sp: [
    { n: 'Chevalier gambette', sci: 'Tringa totanus', v: { milieu: 'Vasières et prés salés, très commun', pattes: ['Rouge orangé', 'r'], bec: 'Moyen, base rouge', vol: 'Large bord de fuite blanc sur toute l\'aile', voix: 'Alarme flûtée descendante, très bruyant' } },
    { n: 'Chevalier arlequin', sci: 'Tringa erythropus', v: { milieu: 'Vasières et étangs en migration', pattes: ['Rouge sombre, plus longues', 'r'], bec: 'Long et fin, rouge seulement à la base de la mandibule inférieure', vol: 'Pas de bord de fuite blanc, blanc en coin sur le dos', voix: '« tchu-ît » sifflé' } },
    { n: 'Chevalier aboyeur', sci: 'Tringa nebularia', v: { milieu: 'Vasières et étangs en migration', pattes: 'Vert grisâtre', bec: 'Fort, légèrement retroussé', vol: 'Blanc en coin sur le dos, ailes sombres', voix: '« tiu-tiu-tiu » à trois notes' } },
    { n: 'Chevalier culblanc', sci: 'Tringa ochropus', v: { milieu: 'Bords de petits étangs et fossés, souvent seul', pattes: 'Vert sombre, courtes', bec: 'Droit, moyen', vol: 'Dessus très sombre, croupion blanc tranché, dessous des ailes noirâtre', voix: '« tluî-ouit-ouit » sonore à l\'envol' } },
    { n: 'Chevalier sylvain', sci: 'Tringa glareola', v: { milieu: 'Mares et étangs à bords herbeux, en migration', pattes: 'Jaunâtres, plus longues', bec: 'Droit, assez court', vol: 'Dessus brun moucheté, croupion blanc, dessous des ailes pâle', voix: '« guif-guif-guif » sec' } },
    { n: 'Chevalier guignette', sci: 'Actitis hypoleucos', v: { milieu: 'Berges de rivières et d\'étangs', pattes: 'Gris vert, courtes', bec: 'Court et droit', vol: 'Au ras de l\'eau, battements raides, ailes arquées vers le bas', voix: '« hidi-di-di » aigu' } }
  ],
  pairs: [
    ['Chevalier gambette', 'Chevalier arlequin', 'vol', 'Tous deux ont les pattes rouges. En vol, le gambette montre un large bord de fuite blanc que l\'arlequin n\'a pas. Au sol, bec plus long et fin chez l\'arlequin.'],
    ['Chevalier gambette', 'Chevalier aboyeur', 'pattes', 'Pattes rouges chez le gambette, vert grisâtre chez l\'aboyeur, dont le bec est légèrement retroussé.'],
    ['Chevalier culblanc', 'Chevalier sylvain', 'vol', 'Contraste très fort chez le culblanc : dessus presque noir et dessous des ailes noirâtre. Le sylvain est plus clair, moucheté, avec le dessous des ailes pâle.'],
    ['Chevalier guignette', 'Chevalier culblanc', 'vol', 'La guignette vole au ras de l\'eau, ailes arquées vers le bas, sans croupion blanc. Au sol, elle balance sans cesse l\'arrière-train.']
  ]
},
{
  id: 'petitsbruns', name: 'Les petits bruns du jardin', sub: 'Moineaux, accenteur et femelles',
  ctx: 'Tous bruns et striés. Le bec dit d\'abord si c\'est un insectivore ou un granivore, puis l\'aile et la tête départagent.',
  dims: [['milieu', 'Milieu'], ['bec', 'Bec'], ['tete', 'Tête'], ['aile', 'Aile et queue'], ['comp', 'Comportement']],
  read: ['bec', 'aile', 'tete'],
  sp: [
    { n: 'Accenteur mouchet', sci: 'Prunella modularis', v: { milieu: 'Haies, jardins, sous-bois', bec: 'Fin et pointu, d\'insectivore', tete: 'Tête et poitrine gris ardoise', aile: 'Brune striée, sans barre nette', comp: 'Se faufile au sol comme une souris, agite les ailes' } },
    { n: 'Moineau domestique (femelle)', w: 'Moineau domestique', sci: 'Passer domesticus', v: { milieu: 'Villages et jardins, en groupes', bec: ['Conique et gros', 'c'], tete: 'Sourcil chamois derrière l\'œil, sans marque noire', aile: 'Une barre alaire claire discrète', comp: 'Sautille en groupes bruyants' } },
    { n: 'Moineau friquet', sci: 'Passer montanus', v: { milieu: 'Campagne, fermes et haies, moins urbain', bec: ['Conique', 'c'], tete: 'Calotte marron, tache noire sur la joue blanche', aile: 'Deux barres alaires claires', comp: 'Mâle et femelle identiques, en petits groupes' } },
    { n: 'Pinson des arbres (femelle)', w: 'Pinson des arbres', sci: 'Fringilla coelebs', v: { milieu: 'Bois, parcs et jardins, au sol en hiver', bec: ['Conique, assez fin', 'c'], tete: 'Unie gris brun, sans marque', aile: 'Deux barres blanches et épaule blanche, bords de queue blancs', comp: 'Marche au sol en hochant la tête' } },
    { n: 'Bruant des roseaux (femelle)', w: 'Bruant des roseaux', sci: 'Emberiza schoeniclus', v: { milieu: 'Roselières et friches humides ; champs en hiver', bec: ['Conique, culmen bombé', 'c'], tete: 'Moustache sombre bordée de crème, sourcil chamois', aile: 'Barres alaires brunes', comp: 'Agite la queue aux bords blancs' } }
  ],
  pairs: [
    ['Accenteur mouchet', 'Moineau domestique (femelle)', 'bec', 'Bec fin d\'insectivore chez l\'accenteur, bec conique de granivore chez le moineau. L\'accenteur a aussi la tête et la poitrine gris ardoise.'],
    ['Moineau domestique (femelle)', 'Pinson des arbres (femelle)', 'aile', 'Deux barres blanches à l\'aile, épaule blanche et bords de queue blancs chez la femelle de pinson. Le moineau n\'a qu\'une barre claire discrète.'],
    ['Moineau domestique (femelle)', 'Moineau friquet', 'tete', 'Calotte marron et tache noire sur la joue blanche chez le friquet. La femelle de moineau domestique n\'a pas de marque noire.'],
    ['Moineau domestique (femelle)', 'Bruant des roseaux (femelle)', 'tete', 'Moustache sombre bordée de crème chez la femelle de bruant des roseaux. Le moineau a seulement un sourcil chamois.']
  ]
}
];
