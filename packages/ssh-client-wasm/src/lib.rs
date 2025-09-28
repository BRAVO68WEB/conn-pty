// SPDX-License-Identifier: MIT
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{CloseEvent, ErrorEvent, Event, MessageEvent, WebSocket};
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SshClientOptions {
    // Built-in WebSocket transport
    pub ws_url: String,
    pub username: Option<String>,
    pub auth_token: Option<String>,
}

#[wasm_bindgen]
pub struct SshClient {
    // Transport state
    ws: Option<WebSocket>,
    custom_send: Rc<RefCell<Option<js_sys::Function>>>,
    custom_close: Rc<RefCell<Option<js_sys::Function>>>,

    options: SshClientOptions,

    // Hooks and transforms
    send_hook: Rc<RefCell<Option<js_sys::Function>>>,
    recv_hook: Rc<RefCell<Option<js_sys::Function>>>,
    transform_out: Rc<RefCell<Option<js_sys::Function>>>,
    transform_in: Rc<RefCell<Option<js_sys::Function>>>,

    // Event callbacks
    output_cb: Rc<RefCell<Option<js_sys::Function>>>,
    open_cb: Rc<RefCell<Option<js_sys::Function>>>,
    close_cb: Rc<RefCell<Option<js_sys::Function>>>,
    error_cb: Rc<RefCell<Option<js_sys::Function>>>,

    // Closures held to keep them alive
    onmessage_closure: Option<Closure<dyn FnMut(MessageEvent)>>,
    onopen_closure: Option<Closure<dyn FnMut(Event)>>,
    onclose_closure: Option<Closure<dyn FnMut(CloseEvent)>>,
    onerror_closure: Option<Closure<dyn FnMut(ErrorEvent)>>,
}

#[wasm_bindgen]
impl SshClient {
    #[wasm_bindgen(constructor)]
    pub fn new(opts: JsValue) -> Result<SshClient, JsValue> {
        console_error_panic_hook::set_once();
        let options: SshClientOptions = serde_wasm_bindgen::from_value(opts)?;

        Ok(SshClient {
            ws: None,
            custom_send: Rc::new(RefCell::new(None)),
            custom_close: Rc::new(RefCell::new(None)),
            options,
            send_hook: Rc::new(RefCell::new(None)),
            recv_hook: Rc::new(RefCell::new(None)),
            transform_out: Rc::new(RefCell::new(None)),
            transform_in: Rc::new(RefCell::new(None)),
            output_cb: Rc::new(RefCell::new(None)),
            open_cb: Rc::new(RefCell::new(None)),
            close_cb: Rc::new(RefCell::new(None)),
            error_cb: Rc::new(RefCell::new(None)),
            onmessage_closure: None,
            onopen_closure: None,
            onclose_closure: None,
            onerror_closure: None,
        })
    }

    // Connect using built-in WebSocket transport
    #[wasm_bindgen]
    pub fn connect_websocket(&mut self) -> Result<(), JsValue> {
        let ws = WebSocket::new(&self.options.ws_url)?;
        ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
        self.ws = Some(ws.clone());
        self.attach_ws_handlers(ws)?;
        Ok(())
    }

    fn attach_ws_handlers(&mut self, ws: WebSocket) -> Result<(), JsValue> {
        // Message handler
        let output_cb_rc = Rc::clone(&self.output_cb);
        let recv_hook_rc = Rc::clone(&self.recv_hook);
        let transform_in_rc = Rc::clone(&self.transform_in);
        let onmessage = Closure::<dyn FnMut(MessageEvent)>::new(move |e: MessageEvent| {
            // Prefer binary data, fallback to text
            let mut text: Option<String> = None;
            if let Ok(buf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
                let uint8 = js_sys::Uint8Array::new(&buf);
                let mut data = vec![0u8; uint8.length() as usize];
                uint8.copy_to(&mut data);
                let mut val: JsValue = js_sys::Uint8Array::from(data.as_slice()).into();
                if let Some(hook) = recv_hook_rc.borrow().as_ref() {
                    // hook(data: Uint8Array) -> Uint8Array|JsString
                    if let Ok(ret) = hook.call1(&JsValue::NULL, &val) { val = ret; }
                }
                // Transform incoming payload to displayable text
                if let Some(tf) = transform_in_rc.borrow().as_ref() {
                    if let Ok(ret) = tf.call1(&JsValue::NULL, &val) {
                        text = ret.as_string();
                    }
                }
                if text.is_none() {
                    text = Some(String::from_utf8_lossy(&data).to_string());
                }
            } else if let Ok(txt) = e.data().dyn_into::<js_sys::JsString>() {
                text = Some(String::from(txt));
            }
            if let Some(t) = text {
                if let Some(cb) = output_cb_rc.borrow().as_ref() {
                    let _ = cb.call1(&JsValue::NULL, &JsValue::from_str(&t));
                }
            } else {
                log("SSH Client: Received unknown message type");
            }
        });
        ws.set_onmessage(Some(onmessage.as_ref().unchecked_ref()));
        self.onmessage_closure = Some(onmessage);

        // Open handler
        let open_cb_rc = Rc::clone(&self.open_cb);
        let ws_clone = ws.clone();
        let onopen = Closure::<dyn FnMut(Event)>::new(move |_e: Event| {
            if let Some(cb) = open_cb_rc.borrow().as_ref() { let _ = cb.call0(&JsValue::NULL); }
            // Optional auth handshake (token-based)
            // This is transport-level; protocol-level auth is provided via methods
            let _ = ws_clone.send_with_str(&serde_json::json!({"type":"hello"}).to_string());
        });
        ws.set_onopen(Some(onopen.as_ref().unchecked_ref()));
        self.onopen_closure = Some(onopen);

        // Close handler
        let close_cb_rc = Rc::clone(&self.close_cb);
        let onclose = Closure::<dyn FnMut(CloseEvent)>::new(move |_e: CloseEvent| {
            if let Some(cb) = close_cb_rc.borrow().as_ref() { let _ = cb.call0(&JsValue::NULL); }
        });
        ws.set_onclose(Some(onclose.as_ref().unchecked_ref()));
        self.onclose_closure = Some(onclose);

        // Error handler
        let error_cb_rc = Rc::clone(&self.error_cb);
        let onerror = Closure::<dyn FnMut(ErrorEvent)>::new(move |_e: ErrorEvent| {
            if let Some(cb) = error_cb_rc.borrow().as_ref() { let _ = cb.call0(&JsValue::NULL); }
        });
        ws.set_onerror(Some(onerror.as_ref().unchecked_ref()));
        self.onerror_closure = Some(onerror);

        Ok(())
    }

    // Custom transport registration: provide send and close functions.
    // Incoming packets should be forwarded via `handle_incoming` from JS.
    #[wasm_bindgen]
    pub fn register_custom_transport(&mut self, send_fn: js_sys::Function, close_fn: js_sys::Function) {
        *self.custom_send.borrow_mut() = Some(send_fn);
        *self.custom_close.borrow_mut() = Some(close_fn);
    }

    // Hooks and transforms
    #[wasm_bindgen]
    pub fn set_send_hook(&mut self, hook: js_sys::Function) { *self.send_hook.borrow_mut() = Some(hook); }
    #[wasm_bindgen]
    pub fn set_recv_hook(&mut self, hook: js_sys::Function) { *self.recv_hook.borrow_mut() = Some(hook); }
    #[wasm_bindgen]
    pub fn set_transform_out(&mut self, tf: js_sys::Function) { *self.transform_out.borrow_mut() = Some(tf); }
    #[wasm_bindgen]
    pub fn set_transform_in(&mut self, tf: js_sys::Function) { *self.transform_in.borrow_mut() = Some(tf); }

    // Handle incoming packet for custom transport
    #[wasm_bindgen]
    pub fn handle_incoming(&mut self, payload: JsValue) {
        let recv_hook_rc = Rc::clone(&self.recv_hook);
        let transform_in_rc = Rc::clone(&self.transform_in);
        let output_cb_rc = Rc::clone(&self.output_cb);
        let mut val = payload;
        if let Some(hook) = recv_hook_rc.borrow().as_ref() {
            if let Ok(ret) = hook.call1(&JsValue::NULL, &val) { val = ret; }
        }
        // Transform to text if possible
        let mut text: Option<String> = val.as_string();
        if text.is_none() {
            if let Some(tf) = transform_in_rc.borrow().as_ref() {
                if let Ok(ret) = tf.call1(&JsValue::NULL, &val) { text = ret.as_string(); }
            }
        }
        if let Some(t) = text {
            if let Some(cb) = output_cb_rc.borrow().as_ref() { let _ = cb.call1(&JsValue::NULL, &JsValue::from_str(&t)); }
        }
    }

    // Register callbacks
    #[wasm_bindgen]
    pub fn on_output(&mut self, cb: js_sys::Function) { *self.output_cb.borrow_mut() = Some(cb); }
    #[wasm_bindgen]
    pub fn on_open(&mut self, cb: js_sys::Function) { *self.open_cb.borrow_mut() = Some(cb); }
    #[wasm_bindgen]
    pub fn on_close(&mut self, cb: js_sys::Function) { *self.close_cb.borrow_mut() = Some(cb); }
    #[wasm_bindgen]
    pub fn on_error(&mut self, cb: js_sys::Function) { *self.error_cb.borrow_mut() = Some(cb); }

    // Packet-level send (text)
    #[wasm_bindgen]
    pub fn send_text(&self, data: &str) -> Result<(), JsValue> {
        let mut payload: JsValue = JsValue::from_str(data);
        if let Some(tf) = self.transform_out.borrow().as_ref() { if let Ok(ret) = tf.call1(&JsValue::NULL, &payload) { payload = ret; } }
        if let Some(hook) = self.send_hook.borrow().as_ref() { let _ = hook.call1(&JsValue::NULL, &payload); }
        if let Some(ws) = &self.ws { ws.send_with_str(&payload.as_string().unwrap_or_else(|| data.to_string())) }
        else if let Some(send_fn) = self.custom_send.borrow().as_ref() { send_fn.call1(&JsValue::NULL, &payload).map(|_| ()) }
        else { Err(JsValue::from_str("No transport configured")) }
    }

    // Packet-level send (bytes)
    #[wasm_bindgen]
    pub fn send_bytes(&self, data: &[u8]) -> Result<(), JsValue> {
        let mut payload: JsValue = js_sys::Uint8Array::from(data).into();
        if let Some(tf) = self.transform_out.borrow().as_ref() { if let Ok(ret) = tf.call1(&JsValue::NULL, &payload) { payload = ret; } }
        if let Some(hook) = self.send_hook.borrow().as_ref() { let _ = hook.call1(&JsValue::NULL, &payload); }
        if let Some(ws) = &self.ws {
            // Try sending as binary if possible
            if payload.is_instance_of::<js_sys::Uint8Array>() {
                let u8arr = js_sys::Uint8Array::new(&payload);
                ws.send_with_u8_array(&u8arr.to_vec())
            } else if let Some(s) = payload.as_string() {
                ws.send_with_str(&s)
            } else {
                // Fallback: send original bytes
                ws.send_with_u8_array(data)
            }
        } else if let Some(send_fn) = self.custom_send.borrow().as_ref() { send_fn.call1(&JsValue::NULL, &payload).map(|_| ()) }
        else { Err(JsValue::from_str("No transport configured")) }
    }

    // Terminal resize message (protocol-agnostic example)
    #[wasm_bindgen]
    pub fn resize(&self, cols: u32, rows: u32) -> Result<(), JsValue> {
        let payload = serde_json::json!({"type": "resize", "cols": cols, "rows": rows});
        self.send_text(&payload.to_string())
    }

    // Authentication interfaces (protocol-level packets)
    #[wasm_bindgen]
    pub fn set_password_auth(&self, username: &str, password: &str) -> Result<(), JsValue> {
        let packet = serde_json::json!({"type":"auth","method":"password","username":username,"password":password});
        self.send_text(&packet.to_string())
    }
    #[wasm_bindgen]
    pub fn set_private_key_auth(&self, username: &str, private_key_pem: &str, passphrase: Option<String>) -> Result<(), JsValue> {
        let packet = serde_json::json!({"type":"auth","method":"private_key","username":username,"private_key_pem":private_key_pem,"passphrase":passphrase});
        self.send_text(&packet.to_string())
    }

    // Close connection
    #[wasm_bindgen]
    pub fn close(&self) {
        if let Some(ws) = &self.ws { let _ = ws.close(); }
        if let Some(close_fn) = self.custom_close.borrow().as_ref() { let _ = close_fn.call0(&JsValue::NULL); }
    }
}