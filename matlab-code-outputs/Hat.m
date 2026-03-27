

function Hat = Hat(u)

    u1 = u(1);
    u2 = u(2);
    u3 = u(3);

    Hat = [0 -u3 u(2); 
           u3 0 -u(1);
           -u(2) u(1) 0]; 
end