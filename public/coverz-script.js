// FAQ Toggle Functionality
function toggleFAQ(button) {
    const faqItem = button.parentElement;
    const isActive = faqItem.classList.contains('active');
    
    // Close all FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // If this item wasn't active, open it
    if (!isActive) {
        faqItem.classList.add('active');
    }
}

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    // Handle smooth scrolling for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Mobile sticky CTA visibility
    const stickyButton = document.querySelector('.mobile-sticky-cta');
    const heroSection = document.querySelector('.hero');
    
    if (stickyButton && heroSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    stickyButton.style.transform = 'translateY(100%)';
                } else {
                    stickyButton.style.transform = 'translateY(0)';
                }
            });
        }, {
            threshold: 0.1
        });
        
        observer.observe(heroSection);
    }
    
    // Add loading animation for product cards
    const productCards = document.querySelectorAll('.product-card, .collection-card');
    
    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });
    
    productCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        cardObserver.observe(card);
    });
    
    // Add to cart functionality (placeholder)
    document.querySelectorAll('.btn-primary').forEach(button => {
        if (button.textContent.includes('Add to Cart')) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Visual feedback
                const originalText = this.textContent;
                this.textContent = 'Added!';
                this.style.backgroundColor = '#28a745';
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.backgroundColor = '';
                }, 2000);
                
                // Here you would typically integrate with your cart system
                console.log('Product added to cart');
            });
        }
    });
    
    // View Details functionality (placeholder)
    document.querySelectorAll('.btn-outline').forEach(button => {
        if (button.textContent.includes('View Details')) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Here you would typically open a product detail modal or navigate to product page
                console.log('View product details');
                
                // For demo purposes, show an alert
                alert('Product details would open here. This would typically show more images, descriptions, and specifications.');
            });
        }
    });
    
    // Collection navigation
    document.querySelectorAll('.collection-cta').forEach(link => {
        link.addEventListener('click', function(e) {
            const collectionName = this.closest('.collection-card').querySelector('h3').textContent;
            
            // Allow bed covers link to work normally
            if (collectionName === 'Bed Covers') {
                // Let the default link behavior work (navigate to /bed-covers)
                return;
            }
            
            // For other collections, prevent default and show demo behavior
            e.preventDefault();
            console.log(`Navigate to ${collectionName} collection`);
            
            // For demo purposes, scroll to bestsellers section
            const bestsellersSection = document.querySelector('.bestsellers');
            if (bestsellersSection) {
                bestsellersSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add hover effects for better interactivity
    document.querySelectorAll('.product-card, .collection-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Trust badge animation
    const trustBadges = document.querySelectorAll('.badge');
    trustBadges.forEach((badge, index) => {
        badge.style.animationDelay = `${index * 0.1}s`;
        badge.classList.add('fade-in');
    });
});

// Add CSS animation class
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        animation: fadeInUp 0.6s ease forwards;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .mobile-sticky-cta {
        transition: transform 0.3s ease;
    }
`;
document.head.appendChild(style);
