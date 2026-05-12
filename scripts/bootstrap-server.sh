#!/bin/bash
# Casino server bootstrap. Run once on a fresh Ubuntu/Debian Linode as root.
# Sets up nginx and a 'deploy' user that GitHub Actions can rsync to.
# Safe to run more than once.

set -euo pipefail

REPO_URL="https://github.com/squelch32/roulette-casino"
SITE_ROOT="/var/www/casino"

echo "==> Updating system packages (this can take a couple minutes)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get -y -o Dpkg::Options::=--force-confold upgrade

echo "==> Installing nginx, rsync, openssh-client..."
apt-get install -y nginx rsync openssh-client

echo "==> Creating 'deploy' user (if missing)..."
if ! id -u deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
fi

echo "==> Preparing deploy user's SSH config..."
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh

if [ ! -f /home/deploy/.ssh/id_ed25519 ]; then
  sudo -u deploy ssh-keygen -t ed25519 \
    -f /home/deploy/.ssh/id_ed25519 \
    -N "" \
    -C "github-actions-deploy"
fi

touch /home/deploy/.ssh/authorized_keys
cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys
sort -u /home/deploy/.ssh/authorized_keys -o /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> Creating site root at ${SITE_ROOT}..."
install -d -m 755 -o deploy -g deploy "$SITE_ROOT"

if [ ! -f "${SITE_ROOT}/index.html" ]; then
  cat > "${SITE_ROOT}/index.html" <<'PLACEHOLDER_HTML'
<!doctype html>
<title>casino · setting up</title>
<style>body{font-family:system-ui;background:#0a3a2a;color:#f5f0d6;display:grid;place-items:center;height:100vh;margin:0}main{text-align:center}h1{font-size:2rem}p{opacity:.8}</style>
<main>
  <h1>casino · setting up</h1>
  <p>Server is alive. First deploy will replace this page.</p>
</main>
PLACEHOLDER_HTML
  chown deploy:deploy "${SITE_ROOT}/index.html"
fi

echo "==> Writing nginx site config..."
cat > /etc/nginx/sites-available/casino <<'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/casino;
    index index.html;

    # Make sure the PDF and font load with sensible MIME types.
    types {
        application/pdf    pdf;
        font/otf           otf;
        image/png          png;
        image/x-icon       ico;
        image/svg+xml      svg;
        text/css           css;
        application/javascript js;
        text/html          html;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
NGINX_CONF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/casino /etc/nginx/sites-enabled/casino

echo "==> Testing and reloading nginx..."
nginx -t
systemctl enable --now nginx
systemctl reload nginx

PUBLIC_IP="$(hostname -I | awk '{print $1}')"

cat <<EOF

================== ALL SET ==================

Placeholder page is live:
  http://${PUBLIC_IP}

Two GitHub Secrets to add at:
  ${REPO_URL}/settings/secrets/actions

  1) Name:  LINODE_HOST
     Value: ${PUBLIC_IP}

  2) Name:  LINODE_SSH_KEY
     Value: everything between the dashed lines below
            (include the BEGIN and END lines, no extra spaces)

----- BEGIN LINODE_SSH_KEY -----
$(cat /home/deploy/.ssh/id_ed25519)
----- END LINODE_SSH_KEY -----

After both secrets are saved, push any commit to main or click
"Run workflow" on the Deploy to Linode action; the real casino
will replace the placeholder page within ~30 seconds.

EOF
