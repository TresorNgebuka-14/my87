const formulaire = document.getElementById("formulaire");
const message = document.getElementById("message");
const galerie = document.getElementById("galerie");

async function verifier() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

function reduireImage(fichier) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const echelle = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * echelle);
      canvas.height = Math.round(img.height * echelle);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
    };
    img.src = URL.createObjectURL(fichier);
  });
}

async function supprimer(photo) {
  if (!confirm("Supprimer cette photo ?")) return;

  const { data: supprimes, error: erreurFichier } = await db.storage
    .from("photos")
    .remove([photo.file_path]);

  if (erreurFichier || supprimes.length === 0) {
    message.textContent = "Échec de la suppression du fichier.";
    return;
  }

  const { error: erreurTable } = await db
    .from("photos")
    .delete()
    .eq("id", photo.id);

  if (erreurTable) {
    message.textContent = "Fichier supprimé, mais échec pour la ligne.";
    return;
  }

  message.textContent = "Photo supprimée.";
  charger();
}

async function charger() {
  const { data: photos, error } = await db
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    message.textContent = "Erreur de chargement.";
    return;
  }

  galerie.innerHTML = "";

  if (photos.length === 0) {
    galerie.textContent = "Aucune photo pour l'instant.";
    return;
  }

  const { data: s } = await db.auth.getSession();
  const monId = s.session.user.id;
  const chemins = photos.map((p) => p.file_path);
  const { data: liens } = await db.storage
    .from("photos")
    .createSignedUrls(chemins, 3600);

  photos.forEach((p, i) => {
    const bloc = document.createElement("figure");
    const img = document.createElement("img");
    img.src = liens[i].signedUrl;
    img.alt = p.caption || "Photo";
    img.style.maxWidth = "100%";
    const legende = document.createElement("figcaption");
    legende.textContent = p.caption || "";
    bloc.append(img, legende);
    if (p.author === monId) {
      const bouton = document.createElement("button");
      bouton.textContent = "Supprimer";
      bouton.addEventListener("click", () => supprimer(p));
      bloc.append(bouton);
    }
    galerie.append(bloc);
  });
}

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "Envoi en cours...";

  const fichier = document.getElementById("fichier").files[0];
  const legende = document.getElementById("legende").value;

  const blob = await reduireImage(fichier);

  const { data: s } = await db.auth.getSession();
  const chemin = s.session.user.id + "/" + Date.now() + ".jpg";

  const { error: erreurFichier } = await db.storage
    .from("photos")
    .upload(chemin, blob, { contentType: "image/jpeg" });

  if (erreurFichier) {
    message.textContent = "Échec de l'envoi du fichier.";
    return;
  }

  const { error: erreurTable } = await db
    .from("photos")
    .insert({ file_path: chemin, caption: legende });

  if (erreurTable) {
    message.textContent = "Fichier envoyé, mais échec de l'enregistrement.";
    return;
  }

  formulaire.reset();
  message.textContent = "Photo ajoutée !";
  charger();
});

verifier().then((ok) => {
  if (ok) charger();
});
