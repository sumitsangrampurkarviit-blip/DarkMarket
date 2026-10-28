const Cart = {
    getItems() {
        return JSON.parse(localStorage.getItem('darkmarket_cart')) || [];
    },
    saveItems(items) {
        localStorage.setItem('darkmarket_cart', JSON.stringify(items));
        this.updateCartBadge();
    },
    addItem(productId, quantity = 1, price = 0, name = '') {
        const items = this.getItems();
        const existing = items.find(i => i.product_id === productId);
        if (existing) {
            existing.quantity += parseInt(quantity);
        } else {
            items.push({ product_id: productId, quantity: parseInt(quantity), price: parseFloat(price), name: name });
        }
        this.saveItems(items);
        alert('Item added to cart.');
    },
    removeItem(productId) {
        let items = this.getItems();
        items = items.filter(i => i.product_id !== productId);
        this.saveItems(items);
        this.renderCartPage();
    },
    updateQuantity(productId, quantity) {
        let items = this.getItems();
        const item = items.find(i => i.product_id === productId);
        if (item) {
            item.quantity = parseInt(quantity);
            if (item.quantity <= 0) {
                items = items.filter(i => i.product_id !== productId);
            }
            this.saveItems(items);
            this.renderCartPage();
        }
    },
    clear() {
        localStorage.removeItem('darkmarket_cart');
        this.updateCartBadge();
    },
    getCount() {
        return this.getItems().reduce((total, item) => total + item.quantity, 0);
    },
    updateCartBadge() {
        const badge = document.getElementById('cart-badge');
        if (badge) {
            badge.textContent = this.getCount();
        }
    },
    async renderCartPage() {
        const cartContainer = document.getElementById('cart-items');
        if (!cartContainer) return;
        
        const items = this.getItems();
        if (items.length === 0) {
            cartContainer.innerHTML = '<p>Your cart is empty. Start shopping.</p>';
            document.getElementById('cart-total').textContent = '0.00';
            return;
        }

        let html = '<table><thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th>Remove</th></tr></thead><tbody>';
        let total = 0;

        for (const item of items) {
            const subtotal = item.price * item.quantity;
            total += subtotal;
            html += `
                <tr>
                    <td>${item.name || 'Product ' + item.product_id}</td>
                    <td class="price">$${item.price.toFixed(2)}</td>
                    <td>
                        <button class="btn" style="padding: 0.2rem 0.5rem" onclick="Cart.updateQuantity('${item.product_id}', ${item.quantity - 1})">-</button>
                        <span style="padding: 0 0.5rem">${item.quantity}</span>
                        <button class="btn" style="padding: 0.2rem 0.5rem" onclick="Cart.updateQuantity('${item.product_id}', ${item.quantity + 1})">+</button>
                    </td>
                    <td class="price">$${subtotal.toFixed(2)}</td>
                    <td><button class="btn" onclick="Cart.removeItem('${item.product_id}')">X</button></td>
                </tr>
            `;
        }
        html += '</tbody></table>';
        cartContainer.innerHTML = html;
        document.getElementById('cart-total').textContent = total.toFixed(2);
    },
    getCheckoutData() {
        return this.getItems();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Cart.updateCartBadge();
});

function addToCart(productId, price, name) {
    const qtyInput = document.getElementById('qty-' + productId);
    const quantity = qtyInput ? qtyInput.value : 1;
    Cart.addItem(productId, quantity, price, name);
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if(el) {
        navigator.clipboard.writeText(el.innerText).then(() => {
            alert("Copied to clipboard!");
        });
    }
}
