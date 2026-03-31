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
        <h1>HA Learn IR - Create IR Code</h1>
        <div class="form-group">
          <label for="platform">Platform:</label>
          <select id="platform">
            <option value="climate">Climate</option>
            <option value="fan">Fan</option>
            <option value="light">Light</option>
            <option value="media_player">Media Player</option>
          </select>
        </div>
        <div class="form-group">
          <label for="code">Code:</label>
          <input type="text" id="code" placeholder="e.g., 1133">
        </div>
        <div class="form-group">
          <label for="data">JSON Data:</label>
          <textarea id="data" rows="10" placeholder='{"commands": {"on": "IR_CODE"}}'></textarea>
        </div>
        <button @click=${this._createCode}>Create Code</button>
      </div>
    `;
  }

  _createCode() {
    const platform = this.shadowRoot.getElementById('platform').value;
    const code = this.shadowRoot.getElementById('code').value;
    const data = this.shadowRoot.getElementById('data').value;

    if (!platform || !code || !data) {
      alert('Please fill all fields');
      return;
    }

    this.hass.callService('ha_learn_ir', 'create_ir_code', {
      platform,
      code,
      data,
    }).then(() => {
      alert('IR code created successfully');
    }).catch((error) => {
      alert('Error creating IR code: ' + error.message);
    });
  }
}

customElements.define('ha-learn-ir-panel', HaLearnIrPanel);