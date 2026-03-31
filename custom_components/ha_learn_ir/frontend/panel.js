import { LitElement, html, css } from 'lit';

class HaLearnIrPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      .container {
        padding: 16px;
      }
      .form-group {
        margin-bottom: 16px;
      }
      label {
        display: block;
        margin-bottom: 4px;
      }
      select, input, textarea {
        width: 100%;
        padding: 8px;
        box-sizing: border-box;
      }
      button {
        padding: 10px 20px;
        background-color: var(--primary-color);
        color: white;
        border: none;
        cursor: pointer;
      }
      button:hover {
        background-color: var(--primary-color-dark);
      }
    `;
  }

  render() {
    return html`
      <div class="container">
        <h1>HA Learn IR</h1>
        <p>Ceci est la page de test de l'addon HA Learn IR.</p>
        <p>Le composant fonctionne (enfin). 😊</p>
      </div>
    `;
  }

  _createCode() {
    // page test : rien à faire ici
  }
}

customElements.define('ha-learn-ir-panel', HaLearnIrPanel);