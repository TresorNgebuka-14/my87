const formulaire = document.getElementById("formulaire");
const texte = document.getElementById("texte");
const info = document.getElementById("info");
const liste = document.getElementById("liste");

let monId = null;

async function verifier() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.href = "index.html";
    return null;
  }
  return data.session.user.id;
}

async function supprimer(m) {
  if (!confirm("Supprimer ce message ?")) return;

  if (m.kind === "audio") {
    const { data: supprimes, error: erreurFichier } = await db.storage
      .from("vocaux")
      .remove([m.audio_path]);

    if (erreurFichier || supprimes.length === 0) {
      info.textContent = "Échec de la suppression du vocal.";
      return;
    }
  }

  const { data: effaces, error } = await db
    .from("messages")
    .delete()
    .eq("id", m.id)
    .select();

  if (error || effaces.length === 0) {
    info.textContent = "Échec de la suppression du message.";
    return;
  }

  info.textContent = "";
  charger();
}

async function charger() {
  const { data: messages, error } = await db
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    info.textContent = "Erreur de chargement.";
    return;
  }

  liste.innerHTML = "";

  if (messages.length === 0) {
    liste.textContent = "Aucun message pour l'instant.";
    return;
  }

  const cheminsAudio = messages
    .filter((m) => m.kind === "audio")
    .map((m) => m.audio_path);

  const liens = {};
  if (cheminsAudio.length > 0) {
    const { data } = await db.storage
      .from("vocaux")
      .createSignedUrls(cheminsAudio, 3600);
    data.forEach((l) => {
      liens[l.path] = l.signedUrl;
    });
  }

  messages.forEach((m) => {
    const bloc = document.createElement("div");

    const qui = m.author === monId ? "Moi" : "L'autre";
    const date = new Date(m.created_at).toLocaleString("fr-FR");
    const entete = document.createElement("small");
    entete.textContent = qui + " — " + date;

    const corps = document.createElement("p");
    if (m.kind === "texte") {
      corps.textContent = m.content;
    } else if (m.kind === "audio") {
      const lien = liens[m.audio_path];
      if (lien) {
        const lecteur = document.createElement("audio");
        lecteur.controls = true;
        lecteur.src = lien;
        corps.append(lecteur);
      } else {
        corps.textContent = "Vocal indisponible.";
      }
    }

    bloc.append(entete, corps);

    if (m.author === monId) {
      const bouton = document.createElement("button");
      bouton.textContent = "Supprimer";
      bouton.addEventListener("click", () => supprimer(m));
      bloc.append(bouton);
    }

    liste.append(bloc);
  });
}

messages.forEach((m) => {
  const bloc = document.createElement("div");

  const qui = m.author === monId ? "Moi" : "L'autre";
  const date = new Date(m.created_at).toLocaleString("fr-FR");
  const entete = document.createElement("small");
  entete.textContent = qui + " — " + date;

  const corps = document.createElement("p");
  if (m.kind === "texte") {
    corps.textContent = m.content;
  }

  bloc.append(entete, corps);
  liste.append(bloc);
});

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();

  const contenu = texte.value.trim();
  if (contenu === "") return;

  const { error } = await db
    .from("messages")
    .insert({ kind: "texte", content: contenu });

  if (error) {
    info.textContent = "Échec de l'envoi.";
    return;
  }

  texte.value = "";
  info.textContent = "";
  charger();
});

verifier().then((id) => {
  if (id) {
    monId = id;
    charger();
  }
});

const micro = document.getElementById("micro");
const etat = document.getElementById("etat");

let enregistreur = null;
let morceaux = [];

function choisirFormat() {
  const formats = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return formats.find((f) => MediaRecorder.isTypeSupported(f)) || "";
}

micro.addEventListener("click", async () => {
  if (!window.MediaRecorder || !navigator.mediaDevices) {
    info.textContent = "Micro indisponible (il faut HTTPS ou localhost).";
    return;
  }

  if (enregistreur && enregistreur.state === "recording") {
    enregistreur.stop();
    return;
  }

  let flux;
  try {
    flux = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    info.textContent = "Micro refusé ou indisponible.";
    return;
  }

  const format = choisirFormat();
  enregistreur = format
    ? new MediaRecorder(flux, { mimeType: format })
    : new MediaRecorder(flux);
  morceaux = [];

  enregistreur.ondataavailable = (e) => {
    if (e.data.size > 0) morceaux.push(e.data);
  };

  enregistreur.onstop = async () => {
    flux.getTracks().forEach((t) => t.stop());
    micro.textContent = "🎤 Enregistrer un vocal";
    etat.textContent = "";
    await envoyerVocal(new Blob(morceaux, { type: enregistreur.mimeType }));
  };

  enregistreur.start();
  micro.textContent = "⏹ Arrêter et envoyer";
  etat.textContent = "Enregistrement...";
});

async function envoyerVocal(blob) {
  if (blob.size === 0) {
    info.textContent = "Enregistrement vide.";
    return;
  }

  info.textContent = "Envoi du vocal...";

  const type = blob.type.split(";")[0] || "audio/webm";
  const extension = type.includes("mp4") ? "mp4" : "webm";
  const chemin = monId + "/" + Date.now() + "." + extension;

  const { error: erreurFichier } = await db.storage
    .from("vocaux")
    .upload(chemin, blob, { contentType: type });

  if (erreurFichier) {
    info.textContent = "Échec de l'envoi du vocal.";
    return;
  }

  const { error: erreurTable } = await db
    .from("messages")
    .insert({ kind: "audio", audio_path: chemin });

  if (erreurTable) {
    info.textContent = "Vocal envoyé, mais échec de l'enregistrement.";
    return;
  }

  info.textContent = "";
  charger();
}
